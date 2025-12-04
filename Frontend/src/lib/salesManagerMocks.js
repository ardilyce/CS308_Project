export const INITIAL_PRODUCTS = [
  { id: 201, name: "Ergonomic Chair", price: 320, cost: 170, stock: 12, wishlist: ["Ayse", "Kaan"], campaign: "Winter Drop" },
  { id: 202, name: "USB-C Docking Station", price: 180, cost: 90, stock: 9, wishlist: ["Elif", "Mert"], campaign: "Bundle Week" },
  { id: 203, name: "Noise Cancelling Headphones", price: 80, cost: 40, stock: 5, wishlist: ["Lara"], campaign: "Flash -20%" },
  { id: 204, name: "4K Monitor", price: 520, cost: 280, stock: 7, wishlist: [], campaign: "Creator Picks" },
];

export const MOCK_INVOICES = [
  { id: "INV-1842", date: "2025-02-11", customer: "Mert Kaya", total: 1250, status: "Paid" },
  { id: "INV-1848", date: "2025-02-15", customer: "Elif Karaman", total: 340, status: "Paid" },
  { id: "INV-1850", date: "2025-02-18", customer: "Lara Aksoy", total: 96, status: "Refunded" },
  { id: "INV-1820", date: "2025-01-27", customer: "Kaan Uyar", total: 520, status: "Paid" },
];

export const SALES_LEDGER = [
  { id: "s1", date: "2025-02-11", productId: 201, qty: 2, salePrice: 320, cost: 170, discounted: false },
  { id: "s2", date: "2025-02-15", productId: 202, qty: 1, salePrice: 162, cost: 90, discounted: true },
  { id: "s3", date: "2025-02-16", productId: 203, qty: 1, salePrice: 64, cost: 40, discounted: true },
  { id: "s4", date: "2025-01-27", productId: 204, qty: 1, salePrice: 520, cost: 280, discounted: false },
  // Refund after a discount campaign ended; amount stays at purchase price with discount
  { id: "r1", date: "2025-02-19", productId: 203, qty: -1, salePrice: 64, cost: 40, discounted: true, type: "refund" },
];

export const REFUND_REQUESTS = [
  {
    id: "RF-2301",
    customer: "Lara Aksoy",
    productId: 203,
    product: "Noise Cancelling Headphones",
    purchasePrice: 64,
    campaign: "Flash -20% (campaign ended)",
    purchaseDate: "2025-02-16",
    returned: true,
    refundMethod: "credit_card",
  },
  {
    id: "RF-2302",
    customer: "Onur Demir",
    productId: 202,
    product: "USB-C Docking Station",
    purchasePrice: 180,
    campaign: "Full price (no discount)",
    purchaseDate: "2025-02-12",
    returned: false,
    refundMethod: "account_balance",
  },
  {
    id: "RF-2303",
    customer: "Mert Kaya",
    productId: 201,
    product: "Ergonomic Chair",
    purchasePrice: 288,
    campaign: "Winter Drop -10%",
    purchaseDate: "2025-02-10",
    returned: true,
    refundMethod: "credit_card",
  },
];
