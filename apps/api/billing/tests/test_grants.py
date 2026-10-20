from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from io import StringIO
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.contrib.admin.models import LogEntry
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connections
from django.urls import reverse
from django.utils import timezone

from accounts.lifecycle import delete_account
from accounts.supporter import supporter_tier
from billing import actions
from billing.grants import grant_supporter, grant_tickets, revoke_supporter
from billing.models import ComplimentarySupporter, StarBalance, StarEntry, StarGrant, TicketGrant
from billing.tests.test_billing import published, subscribe
from conftest import make_user
from packs import actions as packs

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def enabled(settings):
    settings.MONETIZATION_ENABLED = True


def test_ticket_grants_are_audited_idempotent_and_not_payments(user):
    reference = uuid4()
    staff = make_user(is_staff=True)
    grant = grant_tickets(user, 10000, "Play review", reference, actor=staff)
    assert grant_tickets(user, 10000, "Play review", reference).pk == grant.pk
    assert StarBalance.objects.get(user=user).units == 10000000
    assert grant.entry.kind == StarEntry.Kind.GIFT
    assert grant.granted_by == staff
    assert not StarGrant.objects.exists()
    with pytest.raises(actions.BillingError, match="different ticket grant"):
        grant_tickets(make_user(), 10000, "Play review", reference)
    with pytest.raises(actions.BillingError, match="different ticket grant"):
        grant_tickets(user, 1, "Play review", reference)
    for tickets in (0, -1, True, 1.5, 1000001):
        with pytest.raises(actions.BillingError):
            grant_tickets(user, tickets, "Play review", uuid4())
    with pytest.raises(actions.BillingError, match="staff"):
        grant_tickets(user, 1, "Play review", uuid4(), actor=make_user())


def test_complimentary_access_unlocks_supporter_and_monthly_perks(user, auth_client):
    grant = grant_supporter(user, "Play review", uuid4())
    with patch("billing.actions.alerts.send") as alert:
        body = auth_client.get(reverse("billing:membership")).json()
    assert not alert.called
    sub = body["subscription"]
    assert sub["active"] and sub["complimentary"]
    assert sub["provider"] == "complimentary"
    assert sub["paid_through"] is None and not sub["auto_renews"]
    assert not sub["management_available"] and not sub["checkout_available"]
    assert sub["bonus_packs_remaining"] == 10
    assert body["star_units"] == 100000
    assert body["publishing"]["limit"] == 10
    assert auth_client.get(reverse("billing:creator-stats")).json()["advanced"]
    user.profile.refresh_from_db()
    assert supporter_tier(user) == "common"
    assert user.profile.supporter_months == 0
    period = actions.active_period(user)
    card_set = published(make_user())
    key = uuid4()
    first = packs.open_bonus_pack(user, card_set, key)
    assert packs.open_bonus_pack(user, card_set, key).pk == first.pk
    period.refresh_from_db()
    assert period.bonus_packs_remaining == 9 and period.grant is None
    assert actions.active_period(user).pk == period.pk
    assert StarBalance.objects.get(user=user).units == 100000
    assert not StarGrant.objects.exists()
    at = timezone.now().astimezone(UTC)
    next_month = datetime(at.year + (at.month == 12), at.month % 12 + 1, 1, tzinfo=UTC)
    with patch("django.utils.timezone.now", return_value=next_month):
        new_period = actions.active_period(user)
        assert new_period.pk != period.pk and new_period.bonus_packs_remaining == 10
        assert actions.active_period(user).pk == new_period.pk
    assert StarBalance.objects.get(user=user).units == 200000
    assert grant_supporter(user, "Play review", grant.pk).pk == grant.pk


def test_paid_membership_remains_visible_and_managed_normally(user, auth_client):
    gift = grant_supporter(user, "Play review", uuid4())
    actions.active_period(user)
    paid = subscribe(user)
    assert actions.active_period(user).pk == paid.pk
    body = auth_client.get(reverse("billing:membership")).json()
    assert not body["subscription"]["complimentary"]
    assert body["subscription"]["provider"] == "web"
    revoke_supporter(gift)
    assert actions.active_period(user).pk == paid.pk


def test_expiry_revocation_closure_and_disabled_features(user, settings):
    expires = timezone.now() + timedelta(days=1)
    grant = grant_supporter(user, "Review", uuid4(), expires_at=expires)
    actions.active_period(user)
    with patch("django.utils.timezone.now", return_value=expires):
        assert actions.active_period(user) is None
    revoke_supporter(grant)
    assert actions.active_period(user) is None
    user.profile.refresh_from_db()
    assert supporter_tier(user) is None
    grant = grant_supporter(user, "Permanent review", uuid4())
    settings.MONETIZATION_ENABLED = False
    assert actions.active_period(user) is None
    settings.MONETIZATION_ENABLED = True
    delete_account(user)
    assert actions.active_period(user) is None
    with pytest.raises(actions.BillingError, match="closed"):
        grant_tickets(user, 1, "Closed", uuid4())
    with pytest.raises(actions.BillingError, match="closed"):
        grant_supporter(user, "Closed", uuid4())


def test_command_replays_safely_and_rolls_back_invalid_ticket_grant(user):
    args = [user.email, "--reference", str(uuid4()), "--reason", "Play review", "--supporter"]
    with pytest.raises(CommandError):
        call_command("grant_account_access", *args, "--tickets", "1000001", stdout=StringIO())
    assert not ComplimentarySupporter.objects.exists()
    call_command("grant_account_access", *args, "--tickets", "10000", stdout=StringIO())
    call_command("grant_account_access", *args, "--tickets", "10000", stdout=StringIO())
    assert ComplimentarySupporter.objects.count() == 1
    assert TicketGrant.objects.count() == 1
    assert StarBalance.objects.get(user=user).units == 10000000


def test_admin_grants_require_permission_and_capture_operator(client, user):
    route = reverse("admin:billing_ticketgrant_add")
    client.force_login(user)
    assert client.get(route).status_code == 302
    staff = make_user(is_staff=True)
    client.force_login(staff)
    assert client.get(route).status_code == 403
    staff.is_superuser = True
    staff.save()
    response = client.post(
        route,
        {"id": str(uuid4()), "user": str(user.pk), "tickets": 250, "reason": "Support credit"},
    )
    assert response.status_code == 302
    grant = TicketGrant.objects.get(user=user)
    assert grant.granted_by == staff and StarBalance.objects.get(user=user).units == 250000
    assert LogEntry.objects.filter(user=staff, object_id=str(grant.pk)).exists()
    route = reverse("admin:billing_complimentarysupporter_add")
    response = client.post(
        route,
        {"user": str(user.pk), "reason": "Reviewer access", "expires_at_0": "", "expires_at_1": ""},
    )
    assert response.status_code == 302
    assert ComplimentarySupporter.objects.get(user=user).granted_by == staff
    response = client.post(route, {"user": str(user.pk), "reason": "Duplicate"})
    assert response.status_code == 200
    assert ComplimentarySupporter.objects.filter(user=user).count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_ticket_and_monthly_grants_are_applied_once():
    user = make_user()
    reference = uuid4()
    barrier = Barrier(3)

    def run(fn):
        try:
            barrier.wait()
            return fn()
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(run, [lambda: grant_tickets(user, 10000, "Play review", reference)] * 3))
    assert StarBalance.objects.get(user=user).units == 10000000
    assert TicketGrant.objects.count() == 1
    grant_supporter(user, "Play review", uuid4())
    with ThreadPoolExecutor(max_workers=3) as pool:
        periods = list(pool.map(run, [lambda: actions.active_period(user)] * 3))
    assert len({period.pk for period in periods}) == 1
    assert StarBalance.objects.get(user=user).units == 10100000
    assert TicketGrant.objects.count() == 2


def test_revoke_admin_action_preserves_tickets(client, user):
    staff = make_user(is_staff=True, is_superuser=True)
    grant = grant_supporter(user, "Reviewer", uuid4(), actor=staff)
    actions.active_period(user)
    client.force_login(staff)
    response = client.post(
        reverse("admin:billing_complimentarysupporter_changelist"),
        {
            "action": "revoke_access",
            "_selected_action": [str(grant.pk)],
        },
    )
    assert response.status_code == 302
    assert actions.active_period(user) is None
    assert StarBalance.objects.get(user=user).units == 100000
    assert LogEntry.objects.filter(user=staff, object_id=str(grant.pk)).exists()


def test_membership_patch_cannot_grant_tickets_or_supporter(auth_client, user):
    response = auth_client.patch(
        reverse("billing:membership"),
        {
            "star_units": 10000000,
            "complimentary": True,
            "subscription": {"active": True, "provider": "complimentary"},
        },
        format="json",
    )
    assert response.status_code == 200
    assert not response.json()["subscription"]["active"]
    assert response.json()["star_units"] == 0
    assert not ComplimentarySupporter.objects.exists()
    assert not TicketGrant.objects.exists()
