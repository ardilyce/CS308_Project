export const mockOrders = [
  {
    id: "ORD-001",
    status: "Preparing Shipment",
    date: "2025-01-20",
    total: 249.90,
    deliveryAddress: "Istanbul - Kadıköy",
    items: [
      { name: "Keyboard", quantity: 1, price: 199.90 },
      { name: "Sticker Pack", quantity: 1, price: 50 }
    ]
  },
  {
    id: "ORD-002",
    status: "Delivered",
    date: "2025-01-10",
    total: 120.50,
    deliveryAddress: "Ankara - Çankaya",
    items: [
      { name: "Notebook", quantity: 2, price: 25.25 },
      { name: "Pen Set", quantity: 1, price: 70 }
    ]
  }
];
