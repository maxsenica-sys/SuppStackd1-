// netlify/functions/create-checkout.js
// Creates a Stripe Checkout session and returns the URL
// Called by the app when user taps "Upgrade to Pro"

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  monthly: "price_1TEXEALqLTr81KltH2wHKNHj",
  annual:  "price_1TEXFeLqLTr81Klto9LfN8Dh",
};

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let plan;
  try {
    ({ plan } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: "Invalid request body" };
  }

  const priceId = PRICES[plan];
  if (!priceId) {
    return { statusCode: 400, body: "Invalid plan. Must be 'monthly' or 'annual'" };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${process.env.APP_URL}?session_id={CHECKOUT_SESSION_ID}&upgraded=true`,
      cancel_url:  `${process.env.APP_URL}?cancelled=true`,
      customer_email: undefined,
      metadata: { plan },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url, sessionId: session.id }),
    };
  } catch (err) {
    console.error("Stripe error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};// netlify/functions/create-checkout.js
// Creates a Stripe Checkout session and returns the URL
// Called by the app when user taps "Upgrade to Pro"

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  monthly: "price_1TEXEALqLTr81KltH2wHKNHj",
  annual:  "price_1TEXFeLqLTr81Klto9LfN8Dh",
};

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let plan;
  try {
    ({ plan } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: "Invalid request body" };
  }

  const priceId = PRICES[plan];
  if (!priceId) {
    return { statusCode: 400, body: "Invalid plan. Must be 'monthly' or 'annual'" };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${process.env.APP_URL}?session_id={CHECKOUT_SESSION_ID}&upgraded=true`,
      cancel_url:  `${process.env.APP_URL}?cancelled=true`,
      customer_email: undefined,
      metadata: { plan },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url, sessionId: session.id }),
    };
  } catch (err) {
    console.error("Stripe error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
