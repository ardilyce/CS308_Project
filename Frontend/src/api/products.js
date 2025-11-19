// src/api/products.js
import axios from "axios";
import { apiUrl } from "../lib/api";

// /api/categories/
export async function fetchCategories() {
  const res = await axios.get(apiUrl("/api/categories/"));
  return res.data;
}

// /api/products/
export async function fetchProducts(params = {}) {
  const res = await axios.get(apiUrl("/api/products/"), { params });
  return res.data;
}

// /api/search/
export async function searchProducts(params = {}) {
  const res = await axios.get(apiUrl("/api/search/"), { params });
  return res.data;
}

// /api/products/:id/
export async function fetchProductDetail(id) {
  const res = await axios.get(apiUrl(`/api/products/${id}/`));
  return res.data;
}