import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./SearchResults.css";
import { API_BASE, mediaUrl } from "../lib/api";

const SORT_OPTIONS = [
  { value: "", label: "Newest" },
  { value: "popularity_desc", label: "Most Popular" },
  { value: "popularity_asc", label: "Least Popular" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name: A-Z" },
  { value: "name_desc", label: "Name: Z-A" },
];

const isTruthyParam = (value) =>
  ["1", "true", "yes", "on"].includes((value || "").toLowerCase());

export default function SearchResults() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const queryParam = searchParams.get("q") ?? "";
  const appliedFilters = useMemo(
    () => ({
      category: searchParams.get("category") ?? "",
      distributor: searchParams.get("distributor") ?? "",
      minPrice: searchParams.get("min_price") ?? "",
      maxPrice: searchParams.get("max_price") ?? "",
      inStock: isTruthyParam(searchParams.get("in_stock")),
      sort: searchParams.get("sort") ?? "",
    }),
    [searchParams],
  );

  const [query, setQuery] = useState(queryParam);
  const [filters, setFilters] = useState(appliedFilters);
  const [results, setResults] = useState(location.state?.results ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    distributors: [],
    price: { min: 0, max: 0 },
  });

  useEffect(() => {
    setQuery(queryParam);
    setFilters(appliedFilters);
  }, [appliedFilters, queryParam]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const params = new URLSearchParams(location.search);
    const requestParams = {};
    ["q", "category", "distributor", "min_price", "max_price", "sort"].forEach(
      (key) => {
        const value = params.get(key);
        if (value) {
          requestParams[key] = value;
        }
      },
    );
    if (isTruthyParam(params.get("in_stock"))) {
      requestParams.in_stock = "1";
    }

    axios
      .get(`${API_BASE}/api/search/`, { params: requestParams })
      .then((res) => {
        if (!active) return;
        if (res.data?.ok) {
          setResults(res.data.results || []);
          if (res.data.filters) {
            setFilterOptions({
              categories: res.data.filters.categories || [],
              distributors: res.data.filters.distributors || [],
              price: res.data.filters.price || { min: 0, max: 0 },
            });
          }
        } else {
          setResults([]);
          setError("Search service is unavailable. Please try again.");
        }
      })
      .catch((err) => {
        console.error("Search request failed:", err);
        if (active) {
          setResults([]);
          setError("Unable to load search results. Please try again.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [location.search]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (filters.category) params.set("category", filters.category);
    if (filters.distributor) params.set("distributor", filters.distributor);
    if (filters.minPrice) params.set("min_price", filters.minPrice);
    if (filters.maxPrice) params.set("max_price", filters.maxPrice);
    if (filters.inStock) params.set("in_stock", "1");
    if (filters.sort) params.set("sort", filters.sort);
    const qs = params.toString();
    navigate(qs ? `/search?${qs}` : "/search");
  };

  const clearFilters = () => {
    setFilters({
      category: "",
      distributor: "",
      minPrice: "",
      maxPrice: "",
      inStock: false,
      sort: "",
    });
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    const qs = params.toString();
    navigate(qs ? `/search?${qs}` : "/search");
  };

  // Sadece görsel/fiyat gösterimi için: TL formatı
  const formatPrice = (value) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(value ?? 0);

  const nothingApplied =
    !queryParam.trim() &&
    !appliedFilters.category &&
    !appliedFilters.distributor &&
    !appliedFilters.minPrice &&
    !appliedFilters.maxPrice &&
    !appliedFilters.inStock;

  return (
    <div className="search-page">
      <div className="search-layout">
        <aside className="filters-panel">
          <h3>Filters</h3>
          <div className="filter-group">
            <label htmlFor="category-filter">Category</label>
            <select
              id="category-filter"
              value={filters.category}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, category: e.target.value }))
              }
            >
              <option value="">All categories</option>
              {filterOptions.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="distributor-filter">Distributor</label>
            <select
              id="distributor-filter"
              value={filters.distributor}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, distributor: e.target.value }))
              }
            >
              <option value="">All distributors</option>
              {filterOptions.distributors.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Price range</label>
            <div className="price-inputs">
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, minPrice: e.target.value }))
                }
              />
              <span>—</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, maxPrice: e.target.value }))
                }
              />
            </div>
            {filterOptions.price.min !== filterOptions.price.max && (
              <p className="range-hint">
                Available {formatPrice(filterOptions.price.min)}–
                {formatPrice(filterOptions.price.max)}
              </p>
            )}
          </div>

          <div className="filter-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={filters.inStock}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, inStock: e.target.checked }))
                }
              />
              In stock only
            </label>
          </div>

          <div className="filter-group">
            <label htmlFor="sort-filter">Sort by</label>
            <select
              id="sort-filter"
              value={filters.sort}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, sort: e.target.value }))
              }
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-actions">
            <button type="button" className="apply-btn" onClick={applyFilters}>
              Apply filters
            </button>
            <button type="button" className="link-btn" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        </aside>

        <main className="search-content">
          {nothingApplied && (
            <p className="helper-text">
              Type a keyword or apply filters to discover products.
            </p>
          )}

          {queryParam.trim() && (
            <div className="active-summary">
              <h2>
                Results for <span className="query-chip">{queryParam}</span>
              </h2>
            </div>
          )}

          {loading && <p className="helper-text">Loading results…</p>}
          {error && <p className="error-text">{error}</p>}

          {!loading && !error && (
            <>
              {results.length === 0 ? (
                <p className="helper-text">
                  No products matched your criteria. Try adjusting filters.
                </p>
              ) : (
                <div className="results-grid">
                  {results.map((product) => {
                    const imgSrc = mediaUrl(product.image_url || product.image || product.thumbnail || product.thumbnail_url || product.image_src);

                    return (
                      <Link
                        to={`/product/${product.id}`}
                        className="result-card-link"
                        key={product.id}
                      >
                        <article className="result-card">
                          <div className="result-image-wrapper">
                            {imgSrc ? (
                              <img
                                src={imgSrc}
                                alt={product.name}
                                className="result-image"
                              />
                            ) : (
                              <div className="result-no-image">No image</div>
                            )}
                          </div>

                          <h3 className="result-title">{product.name}</h3>

                          <p className="result-brand">
                            {product.brand || "Unknown Brand"}
                          </p>

                          <p className="result-price">
                            {formatPrice(product.price)}
                          </p>

                          <p className="result-stock">
                            Stock: {product.stock ?? 0}
                          </p>

                          {product.category && (
                            <p className="result-category">
                              Category: {product.category}
                            </p>
                          )}

                          {product.description && (
                            <p className="result-description">
                              {product.description.slice(0, 110)}...
                            </p>
                          )}
                        </article>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

    
    


                       