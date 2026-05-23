import React, { useState } from "react";

export function ProductCard({ product }) {
  return (
    <a href={product.url} target="_blank" rel="noreferrer" style={styles.card}>
      {product.image && (
        <img src={product.image} alt={product.name} style={styles.img} />
      )}
      <div style={styles.body}>
        <div style={styles.name}>{product.name}</div>
        <div style={styles.price}>{product.price} USD</div>
        <div style={styles.cta}>View product →</div>
      </div>
    </a>
  );
}

export function ProductCards({ products }) {
  const [index, setIndex] = useState(0);
  if (!products?.length) return null;

  const PAGE = 2; // cards visible at a time
  const total = products.length;
  const canPrev = index > 0;
  const canNext = index + PAGE < total;
  const visible = products.slice(index, index + PAGE);

  return (
    <div style={styles.wrapper}>
      {canPrev && (
        <button style={styles.arrow} onClick={() => setIndex(i => i - 1)} aria-label="Previous">‹</button>
      )}
      <div style={styles.row}>
        {visible.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {canNext && (
        <button style={styles.arrow} onClick={() => setIndex(i => i + 1)} aria-label="Next">›</button>
      )}
      {total > PAGE && (
        <div style={styles.dots}>
          {Array.from({ length: Math.ceil(total / PAGE) }, (_, i) => (
            <span
              key={i}
              style={{ ...styles.dot, ...(i === Math.floor(index / PAGE) ? styles.dotActive : {}) }}
              onClick={() => setIndex(i * PAGE)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  row: {
    display: "flex",
    gap: 8,
    flexWrap: "nowrap",
  },
  arrow: {
    position: "absolute",
    top: "40%",
    transform: "translateY(-50%)",
    background: "white",
    border: "1px solid #ddd",
    borderRadius: "50%",
    width: 24,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    cursor: "pointer",
    zIndex: 1,
    boxShadow: "0 1px 4px rgba(0,0,0,.1)",
    color: "#333",
    lineHeight: 1,
    padding: 0,
  },
  dots: {
    display: "flex",
    gap: 4,
    justifyContent: "center",
    paddingTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#ddd",
    cursor: "pointer",
  },
  dotActive: {
    background: "#2563eb",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    width: 130,
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
    textDecoration: "none",
    color: "inherit",
    background: "white",
    boxShadow: "0 1px 3px rgba(0,0,0,.08)",
    transition: "box-shadow .15s",
    flexShrink: 0,
  },
  img: {
    width: "100%",
    height: 90,
    objectFit: "cover",
    background: "#f0f2f5",
  },
  body: {
    padding: "8px 8px 10px",
  },
  name: {
    fontSize: 11,
    fontWeight: 600,
    color: "#1a1a2e",
    marginBottom: 3,
    lineHeight: 1.3,
  },
  price: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: 700,
    marginBottom: 4,
  },
  cta: {
    fontSize: 10,
    color: "#888",
  },
};
