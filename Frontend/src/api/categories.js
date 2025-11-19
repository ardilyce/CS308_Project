// src/api/categories.js
import axios from "axios";
import { apiUrl } from "../lib/api";

export async function fetchCategories() {
  const res = await axios.get(apiUrl("/api/categories/")); // <-- /api/categories/
  return res.data; // DRF ListAPIView: doğrudan [] dönüyor
}