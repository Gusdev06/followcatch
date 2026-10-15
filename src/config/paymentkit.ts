// PaymentKit hosted payment links (public URLs, safe to ship to the browser).
// Account: acc_prod_2c1aa48ecd234963 (FollowCatch, live). Created 2026-10-15.
// Each open creates a fresh checkout session; success redirects to
// https://followcatch.vercel.app/welcome?plan=<plan>&cycle=<cycle>.
// Details: projects/followspy-clone/paymentkit-2026-10-15.md
export const paymentLinks = {
  premium: {
    weekly: "https://app.paymentkit.com/api/pay/share/VaSlSEv5X98anZfpnIFT1rTQJta-w8vFHwutOYy7T_s",
    quarterly: "https://app.paymentkit.com/api/pay/share/Et0K5yRydb9SpXXJJCZ8N-CO7b8BYk9cidtld3Is2N4",
  },
  starter: {
    weekly: "https://app.paymentkit.com/api/pay/share/exmygr-y8c5bt_oZUL4dk-1sfjD1d-hulnKXwgZxKL8",
    quarterly: "https://app.paymentkit.com/api/pay/share/kAy9yTK4I4lRNqO60o7lVN5q_E5mt0U3pVFlLaQjI1w",
  },
} as const;
