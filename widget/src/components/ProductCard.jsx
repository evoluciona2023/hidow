import React from "react";

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
  if (!products?.length) return null;
  return (
    <div style={styles.row}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

const styles = {
  row: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    padding: "4px 0 0",
    alignSelf: "flex-start",
    maxWidth: "100%",
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
