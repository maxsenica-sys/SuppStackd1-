// netlify/functions/stripe-webhook.js
// Listens for Stripe events (payment success, cancellation, etc.)
// Stripe calls this automatically — not called by the app directly

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  try {
    // Verify the webhook came from Stripe — not a fake call
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Handle the events we care about
  switch (stripeEvent.type) {
    case "checkout.session.completed": {
      const session = stripeEvent.data.object;
      // Payment successful — log for debugging
      console.log("✅ New subscription:", {
        customerId: session.customer,
        subscriptionId: session.subscription,
        plan: session.metadata?.plan,
        email: session.customer_email,
      });
      // No DB to write to yet — Pro status is verified
      // live against Stripe on each app load via verify-session
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = stripeEvent.data.object;
      // Subscription cancelled — log it
      console.log("❌ Subscription cancelled:", {
        customerId: subscription.customer,
        subscriptionId: subscription.id,
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = stripeEvent.data.object;
      console.log("⚠️ Payment failed:", {
        customerId: invoice.customer,
        subscriptionId: invoice.subscription,
      });
      break;
    }

    default:
      // Ignore other events
      break;
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
