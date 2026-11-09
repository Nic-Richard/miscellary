from django.core.management.base import BaseCommand

from cards import embeddings, search, tag_groups
from cards import tags as tagging
from cards.models import CardSet

# Searches a collector might type, each with the demo set it should find. Most share no
# words with that set, which is where meaning search has to earn its place.
CASES = [
    ("vintage photography gear", "Film Cameras"),
    ("retro video games", "Consoles, 1972 to 1999"),
    ("mushrooms", "Woodland Fungi"),
    ("rocks", "Pocket Geology"),
    ("sweets", "Bulk Candy"),
    ("outer space", "Planets and Moons"),
    ("fairground rides", "The Midway"),
    ("vinyl", "Records on My Shelf"),
    ("lawn ornaments", "Gnomes and Flamingos"),
    ("birdwatching", "Garden Birds"),
    ("wildflowers", "Plants Along the Trail"),
    ("neon signs", "Open Late"),
    ("typewriters", "Letters by Machine"),
    ("board games", "Kings, Queens and Pawns"),
    ("antique timepieces", "Pocket Watches, Open and Shut"),
    ("bath toys", "Rubber Ducks, in Bulk"),
    ("pens", "Fountain Pens, Old and New"),
    ("locks and keys", "A Bunch of Keys"),
]
TOP = 3


class Command(BaseCommand):
    help = "Score search on fixed demo queries, with and without meaning when embeddings are on."

    def handle(self, *args, **options):
        titles = dict(
            CardSet.objects.filter(status=CardSet.Status.PUBLISHED).values_list("pk", "title")
        )
        missing = {want for _, want in CASES} - set(titles.values())
        if missing:
            self.stderr.write(f"Not in this database, so skipped: {', '.join(sorted(missing))}")
        cases = [(q, want) for q, want in CASES if want not in missing]
        modes = [("words, titles and tags", False)]
        if embeddings.enabled():
            modes.append(("plus meaning", True))
        # One patient request for every query, so a low rate limit can't quietly turn meaning off.
        vectors = (
            dict(
                zip(
                    cases,
                    embeddings.embed([q for q, _ in cases], "query", patient=True),
                    strict=True,
                )
            )
            if embeddings.enabled()
            else {}
        )
        for label, with_meaning in modes:
            hits, reciprocal = 0, 0.0
            lines = []
            for q, want in cases:
                tags = tag_groups.main_tags_matching(q, tagging.slugify_tag(q))[:10]
                vector = vectors[(q, want)] if with_meaning else None
                scores = search.sets(q, tag_groups.group_slugs([t.slug for t in tags]), vector)
                ranked = [titles[pk] for pk in search.best(scores, 10)]
                rank = ranked.index(want) + 1 if want in ranked else None
                hits += bool(rank and rank <= TOP)
                reciprocal += 1 / rank if rank else 0.0
                mark = "✓" if rank and rank <= TOP else "✗"
                lines.append(f"  {mark} {q!r} -> {want}: {rank or 'not found'}")
            mrr = reciprocal / len(cases)
            self.stdout.write(f"\n{label}: {hits}/{len(cases)} in the top {TOP}, MRR {mrr:.2f}")
            self.stdout.write("\n".join(lines))
