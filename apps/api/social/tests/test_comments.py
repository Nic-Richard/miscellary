import pytest
from django.urls import reverse

from cards.publishing import publish_set
from cards.tests.helpers import fill_publishable, make_set
from conftest import make_user
from social.models import Comment

pytestmark = pytest.mark.django_db


@pytest.fixture
def published(user):
    card_set = make_set(user, title="Garden Beetles")
    fill_publishable(card_set, n_common=4)
    publish_set(card_set)
    card_set.refresh_from_db()
    return card_set


def thread_url(card_set):
    return reverse("social:comments", args=[card_set.slug])


def test_anyone_can_read_but_only_members_can_write(api_client, published):
    assert api_client.get(thread_url(published)).status_code == 200
    assert (
        api_client.post(thread_url(published), {"body": "Nice"}, format="json").status_code == 401
    )


def test_post_and_read_back(api_client, user, published):
    api_client.force_authenticate(user)
    response = api_client.post(thread_url(published), {"body": "  Love card 3.  "}, format="json")
    assert response.status_code == 201
    # Whitespace is trimmed, and the creator of the set is marked as such.
    assert response.json()["body"] == "Love card 3."
    assert response.json()["is_creator"] is True

    body = api_client.get(thread_url(published)).json()
    assert body["count"] == 1
    assert body["results"][0]["author"]["username"] == user.username
    assert body["results"][0]["can_delete"] is True


def test_blank_comment_is_rejected(api_client, user, published):
    api_client.force_authenticate(user)
    assert api_client.post(thread_url(published), {"body": "   "}, format="json").status_code == 400


def test_replies_stay_one_level_deep(api_client, user, published):
    fan = make_user(username="fan")
    api_client.force_authenticate(fan)
    top = api_client.post(thread_url(published), {"body": "Which is rarest?"}, format="json").json()
    reply = api_client.post(
        thread_url(published), {"body": "The foxglove.", "parent_id": top["id"]}, format="json"
    ).json()
    # A reply to a reply joins the same run rather than nesting further.
    deeper = api_client.post(
        thread_url(published), {"body": "Thanks.", "parent_id": reply["id"]}, format="json"
    ).json()

    body = api_client.get(thread_url(published)).json()
    assert body["count"] == 3
    assert len(body["results"]) == 1
    ids = [r["id"] for r in body["results"][0]["replies"]]
    assert ids == [reply["id"], deeper["id"]]


def test_author_can_remove_their_own(api_client, published):
    fan = make_user(username="fan")
    api_client.force_authenticate(fan)
    posted = api_client.post(thread_url(published), {"body": "Oops"}, format="json").json()

    response = api_client.delete(reverse("social:comment", args=[posted["id"]]))
    assert response.status_code == 204
    # Nothing hangs off it, so it goes entirely rather than leaving a gap.
    assert not Comment.objects.filter(id=posted["id"]).exists()
    assert api_client.get(thread_url(published)).json()["count"] == 0


def test_set_creator_can_remove_anyones(api_client, user, published):
    fan = make_user(username="fan")
    api_client.force_authenticate(fan)
    posted = api_client.post(thread_url(published), {"body": "spam spam"}, format="json").json()

    api_client.force_authenticate(user)
    assert api_client.get(thread_url(published)).json()["results"][0]["can_delete"] is True
    assert api_client.delete(reverse("social:comment", args=[posted["id"]])).status_code == 204


def test_a_stranger_cannot_remove(api_client, published):
    author = make_user(username="author")
    api_client.force_authenticate(author)
    posted = api_client.post(thread_url(published), {"body": "Mine"}, format="json").json()

    api_client.force_authenticate(make_user(username="nosy"))
    assert api_client.get(thread_url(published)).json()["results"][0]["can_delete"] is False
    assert api_client.delete(reverse("social:comment", args=[posted["id"]])).status_code == 403


def test_removing_a_comment_with_replies_leaves_a_tombstone(api_client, published):
    author = make_user(username="author")
    api_client.force_authenticate(author)
    top = api_client.post(thread_url(published), {"body": "Question"}, format="json").json()
    api_client.post(
        thread_url(published), {"body": "Answer", "parent_id": top["id"]}, format="json"
    )

    assert api_client.delete(reverse("social:comment", args=[top["id"]])).status_code == 204
    body = api_client.get(thread_url(published)).json()
    kept = body["results"][0]
    assert kept["removed"] is True
    assert kept["body"] == "" and kept["author"] is None
    assert kept["replies"][0]["body"] == "Answer"
    # The tombstone is scaffolding, not a comment, so it is not counted.
    assert body["count"] == 1


def test_cannot_reply_to_a_removed_comment(api_client, published):
    author = make_user(username="author")
    api_client.force_authenticate(author)
    top = api_client.post(thread_url(published), {"body": "Question"}, format="json").json()
    api_client.post(
        thread_url(published), {"body": "Answer", "parent_id": top["id"]}, format="json"
    )
    api_client.delete(reverse("social:comment", args=[top["id"]]))

    response = api_client.post(
        thread_url(published), {"body": "Late", "parent_id": top["id"]}, format="json"
    )
    assert response.status_code == 400


def test_drafts_have_no_thread(api_client, user):
    draft = make_set(user, title="Not yet")
    api_client.force_authenticate(user)
    assert api_client.get(thread_url(draft)).status_code == 404
    assert api_client.post(thread_url(draft), {"body": "Hi"}, format="json").status_code == 404


def test_a_comment_can_be_reported(api_client, published):
    author = make_user(username="author")
    api_client.force_authenticate(author)
    posted = api_client.post(thread_url(published), {"body": "rude"}, format="json").json()

    api_client.force_authenticate(make_user(username="offended"))
    response = api_client.post(
        reverse("social:report"),
        {"comment_id": posted["id"], "reason": "harassment"},
        format="json",
    )
    assert response.status_code == 201
    assert Comment.objects.get(id=posted["id"]).reports.count() == 1
