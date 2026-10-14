"""Inventory Management System - Flask REST API + SQLite."""
import sqlite3
from flask import Flask, jsonify, request, g

DB_PATH = "inventory.db"
LOW_STOCK_LIMIT = 5

app = Flask(__name__, static_folder="static", static_url_path="")


# ---------- Database helpers ----------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    with sqlite3.connect(DB_PATH) as db:
        db.execute(
            """CREATE TABLE IF NOT EXISTS products (
                   id       INTEGER PRIMARY KEY AUTOINCREMENT,
                   name     TEXT    NOT NULL,
                   category TEXT    NOT NULL,
                   quantity INTEGER NOT NULL CHECK (quantity >= 0),
                   price    REAL    NOT NULL CHECK (price >= 0)
               )"""
        )


# ---------- Validation ----------
def clean_number(value, field, integer=False):
    """Return (number, error). Rejects blanks, text, negatives."""
    if value is None or str(value).strip() == "":
        return None, f"{field} is required."
    try:
        num = int(value) if integer else float(value)
    except (ValueError, TypeError):
        kind = "a whole number" if integer else "a number"
        return None, f"{field} must be {kind}."
    if isinstance(value, float) and integer and value != num:
        return None, f"{field} must be a whole number."
    if num < 0:
        return None, f"{field} cannot be negative."
    return num, None


def row_to_dict(row):
    d = dict(row)
    d["low_stock"] = d["quantity"] <= LOW_STOCK_LIMIT
    return d


# ---------- Routes ----------
@app.route("/")
def home():
    return app.send_static_file("index.html")


@app.route("/api/products", methods=["GET"])
def list_products():
    q = request.args.get("q", "").strip()
    db = get_db()
    if q:
        like = f"%{q}%"
        rows = db.execute(
            """SELECT * FROM products
               WHERE name LIKE ? OR category LIKE ? OR CAST(id AS TEXT) = ?
               ORDER BY id""",
            (like, like, q),
        ).fetchall()
    else:
        rows = db.execute("SELECT * FROM products ORDER BY id").fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/products", methods=["POST"])
def add_product():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    category = str(data.get("category", "")).strip()
    if not name:
        return jsonify(error="Name is required."), 400
    if not category:
        return jsonify(error="Category is required."), 400
    qty, err = clean_number(data.get("quantity"), "Quantity", integer=True)
    if err:
        return jsonify(error=err), 400
    price, err = clean_number(data.get("price"), "Price")
    if err:
        return jsonify(error=err), 400

    db = get_db()
    cur = db.execute(
        "INSERT INTO products (name, category, quantity, price) VALUES (?,?,?,?)",
        (name, category, qty, price),
    )
    db.commit()
    row = db.execute("SELECT * FROM products WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(row_to_dict(row)), 201


@app.route("/api/products/<int:pid>", methods=["PUT"])
def update_product(pid):
    """Update quantity and/or price. Only fields sent are changed."""
    data = request.get_json(silent=True) or {}
    db = get_db()
    row = db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
    if row is None:
        return jsonify(error="Product not found."), 404

    qty, price = row["quantity"], row["price"]
    if "quantity" in data:
        qty, err = clean_number(data["quantity"], "Quantity", integer=True)
        if err:
            return jsonify(error=err), 400
    if "price" in data:
        price, err = clean_number(data["price"], "Price")
        if err:
            return jsonify(error=err), 400
    if "quantity" not in data and "price" not in data:
        return jsonify(error="Send quantity or price to update."), 400

    db.execute("UPDATE products SET quantity=?, price=? WHERE id=?", (qty, price, pid))
    db.commit()
    row = db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
    return jsonify(row_to_dict(row))


@app.route("/api/products/<int:pid>/adjust", methods=["PATCH"])
def adjust_stock(pid):
    """Add or remove stock by a change amount (e.g. -3). Blocks going below zero."""
    data = request.get_json(silent=True) or {}
    try:
        change = int(data.get("change"))
    except (ValueError, TypeError):
        return jsonify(error="Change must be a whole number."), 400

    db = get_db()
    row = db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
    if row is None:
        return jsonify(error="Product not found."), 404
    new_qty = row["quantity"] + change
    if new_qty < 0:
        return jsonify(error=f"Not enough stock. Only {row['quantity']} left."), 400

    db.execute("UPDATE products SET quantity=? WHERE id=?", (new_qty, pid))
    db.commit()
    row = db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
    return jsonify(row_to_dict(row))


@app.route("/api/products/<int:pid>", methods=["DELETE"])
def delete_product(pid):
    db = get_db()
    cur = db.execute("DELETE FROM products WHERE id=?", (pid,))
    db.commit()
    if cur.rowcount == 0:
        return jsonify(error="Product not found."), 404
    return jsonify(message="Product deleted.")


init_db()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
