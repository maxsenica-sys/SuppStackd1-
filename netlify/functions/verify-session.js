// netlify/functions/verify-session.js
// Called by the app on load to verify Pro status against Stripe
// Prevents localStorage tampering — Pro is always verified live

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let customerId, sessionId;
  try {
    ({ customerId, sessionId } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: "Invalid request body" };
  }

  try {
    // Case 1 — Fresh upgrade: verify checkout session just completed
    if (sessionId && !customerId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid" && session.subscription) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isPro: true,
            customerId: session.customer,
            subscriptionId: session.subscription,
            plan: session.metadata?.plan || "monthly",
          }),
        };
      }
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPro: false }),
      };
    }

    // Case 2 — Returning user: verify existing customerId still has active sub
    if (customerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });

      const isActive = subscriptions.data.length > 0;
      const sub = subscriptions.data[0];

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPro: isActive,
          customerId,
          subscriptionId: isActive ? sub.id : null,
          plan: isActive ? (sub.metadata?.plan || "monthly") : null,
        }),
      };
    }

    // No customerId or sessionId — definitely free user
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPro: false }),
    };

  } catch (err) {
    console.error("Verify session error:", err.message);
    // On error, default to free — never grant Pro on a failed check
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPro: false, error: err.message }),
    };
  }
};
