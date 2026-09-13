from django.core.management.base import BaseCommand, CommandError

from cards.models import CardDefinition, CardSet
from cards.rendering import (
    back_render_signature,
    card_render_signature,
    card_spot,
    pack_render_signature,
)


class Command(BaseCommand):
    help = "Check that every published set and card has the baked renders it needs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--quiet",
            action="store_true",
            help="Only report what is missing.",
        )

    def handle(self, *args, **options):
        """Apply the same readiness rules the serializers use.

        A published card is only displayed from its baked render, so anything
        this reports as unbaked is a card that shows as an empty frame.
        """
        problems: list[str] = []

        sets = list(CardSet.objects.filter(status=CardSet.Status.PUBLISHED))
        for card_set in sets:
            if card_set.render_back_signature != back_render_signature(card_set) or not (
                card_set.render_back_key
            ):
                problems.append(f"set back not baked: {card_set.slug}")
            if card_set.render_pack_signature != pack_render_signature(card_set) or not (
                card_set.render_pack_key
            ):
                problems.append(f"pack not baked: {card_set.slug}")

        cards = list(
            CardDefinition.objects.filter(card_set__status=CardSet.Status.PUBLISHED).select_related(
                "card_set"
            )
        )
        for card in cards:
            where = f"{card.card_set.slug}/{card.title}"
            if card.render_signature != card_render_signature(card):
                problems.append(f"card render out of date: {where}")
                continue
            missing = [
                name
                for name, key in (
                    ("front", card.render_front_key),
                    ("front thumbnail", card.render_front_thumbnail_key),
                    ("flat thumbnail", card.render_flat_thumbnail_key),
                )
                if not key
            ]
            # Spot work is masked to its region, so those cards need a mask pair.
            if card_spot(card.template_config, card.rarity):
                missing += [
                    name
                    for name, key in (
                        ("mask", card.render_mask_key),
                        ("mask thumbnail", card.render_mask_thumbnail_key),
                    )
                    if not key
                ]
            if missing:
                problems.append(f"card missing {', '.join(missing)}: {where}")

        if problems:
            for problem in problems:
                self.stdout.write(self.style.ERROR(f"  {problem}"))
            raise CommandError(
                f"{len(problems)} problem(s) across {len(sets)} set(s) and {len(cards)} card(s)."
            )

        if not options["quiet"]:
            spot = sum(1 for c in cards if card_spot(c.template_config, c.rarity))
            self.stdout.write(
                self.style.SUCCESS(
                    f"All {len(cards)} published card(s) are baked "
                    f"({spot} with material masks), and all {len(sets)} set(s) "
                    "have a back and a pack."
                )
            )
