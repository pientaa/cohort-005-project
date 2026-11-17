# Cadence

An online course marketplace: learners buy courses, get access to them, and can request a refund within a limited window.

## Language

### Refunds

**Refund**:
The return of a purchase's price to the payment method it was paid with, decided by our team after review. Deciding to refund is not the same as the money arriving; funds take time to land on the card.
_Avoid_: Cancellation, Reversal, Chargeback, Withdrawal, Return. "Money back" is fine in long-form prose (support replies, marketing) but never names the concept or a state.

**Refund request**:
A learner's ask to have a purchase's price returned. It is Requested until our team decides, then either Approved or Declined; these states belong to the request, never to the purchase, which stays a purchase with a refund request attached.
_Avoid_: Cancel my purchase, Cancellation, Reversal, Chargeback

**Requested**:
The learner has asked and our team has not decided yet. The learner still has access to the course.
_Avoid_: Pending refund (implies a refund already exists and is only queued, a promise the review hasn't made), Pending chargeback

**Approved**:
We decided to return the money, and the learner's access ends. The money is on its way to their card, not necessarily there yet. This is the last state of a request.
_Avoid_: Refunded (says the money has arrived)

**Declined**:
We decided not to return the money. The learner keeps access, and may submit a new refund request while the purchase is still eligible. This is the last state of that request.
