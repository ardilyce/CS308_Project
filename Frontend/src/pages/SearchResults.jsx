import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./SearchResults.css";
import { API_BASE, mediaUrl } from "../lib/api";
import { getDiscountedPrice } from "../lib/pricing";

const SORT_OPTIONS = [
  { value: "", label: "Newest" },
  { value: "popularity_desc", label: "Most Popular" },
  { value: "popularity_asc", label: "Least Popular" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name: A-Z" },
  { value: "name_desc", label: "Name: Z-A" },
];

const PAGE_SIZE_OPTIONS = [12, 24, 48];

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

  // Pagination from URL
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("page_size") || "12", 10);

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
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 12,
    total_count: 0,
    total_pages: 0,
    has_next: false,
    has_previous: false,
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

    // Add pagination parameters
    requestParams.page = currentPage;
    requestParams.page_size = pageSize;

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
          if (res.data.pagination) {
            setPagination(res.data.pagination);
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
  }, [location.search, currentPage, pageSize]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (filters.category) params.set("category", filters.category);
    if (filters.distributor) params.set("distributor", filters.distributor);
    if (filters.minPrice) params.set("min_price", filters.minPrice);
    if (filters.maxPrice) params.set("max_price", filters.maxPrice);
    if (filters.inStock) params.set("in_stock", "1");
    if (filters.sort) params.set("sort", filters.sort);
    // Reset to page 1 when filters change
    params.set("page", "1");
    if (pageSize !== 12) params.set("page_size", String(pageSize));
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
    // Reset to page 1 when clearing filters
    params.set("page", "1");
    const qs = params.toString();
    navigate(qs ? `/search?${qs}` : "/search");
  };

  // Navigate to a specific page
  const goToPage = (page) => {
    const params = new URLSearchParams(location.search);
    params.set("page", String(page));
    navigate(`/search?${params.toString()}`);
    // Scroll to top of results
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Change page size
  const changePageSize = (newSize) => {
    const params = new URLSearchParams(location.search);
    params.set("page", "1"); // Reset to first page
    params.set("page_size", String(newSize));
    navigate(`/search?${params.toString()}`);
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const { total_pages, page } = pagination;
    const maxVisible = 5;

    if (total_pages <= maxVisible) {
      for (let i = 1; i <= total_pages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate start and end
      let start = Math.max(2, page - 1);
      let end = Math.min(total_pages - 1, page + 1);

      // Add ellipsis if needed
      if (start > 2) {
        pages.push("...");
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis if needed
      if (end < total_pages - 1) {
        pages.push("...");
      }

      // Always show last page
      pages.push(total_pages);
    }

    return pages;
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
                <>
                  {/* Results count and page size selector */}
                  <div className="results-header">
                    <span className="results-count">
                      Showing {(pagination.page - 1) * pagination.page_size + 1}–
                      {Math.min(pagination.page * pagination.page_size, pagination.total_count)} of{" "}
                      {pagination.total_count} products
                    </span>
                    <div className="page-size-selector">
                      <label htmlFor="page-size">Products per page:</label>
                      <select
                        id="page-size"
                        value={pageSize}
                        onChange={(e) => changePageSize(parseInt(e.target.value, 10))}
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

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
                              {formatPrice(getDiscountedPrice(product))}
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

                  {/* Pagination controls */}
                  {pagination.total_pages > 1 && (
                    <div className="pagination">
                      <button
                        className="pagination-btn pagination-nav"
                        onClick={() => goToPage(pagination.page - 1)}
                        disabled={!pagination.has_previous}
                        aria-label="Previous page"
                      >
                        ← Previous
                      </button>

                      <div className="pagination-pages">
                        {getPageNumbers().map((pageNum, index) =>
                          pageNum === "..." ? (
                            <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                              …
                            </span>
                          ) : (
                            <button
                              key={pageNum}
                              className={`pagination-btn pagination-number ${
                                pageNum === pagination.page ? "active" : ""
                              }`}
                              onClick={() => goToPage(pageNum)}
                              aria-label={`Page ${pageNum}`}
                              aria-current={pageNum === pagination.page ? "page" : undefined}
                            >
                              {pageNum}
                            </button>
                          )
                        )}
                      </div>

                      <button
                        className="pagination-btn pagination-nav"
                        onClick={() => goToPage(pagination.page + 1)}
                        disabled={!pagination.has_next}
                        aria-label="Next page"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
