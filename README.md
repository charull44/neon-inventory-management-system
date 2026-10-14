# Inventory Management System

Flask + SQLite backend, HTML/CSS/JS frontend (Fetch API).

## Run
    pip install -r requirements.txt
    python app.py            # open http://127.0.0.1:5000
    npm install              # optional: lint/format tooling
    npm run lint

## API
| Method | URL | Purpose |
|---|---|---|
| GET | /api/products?q=text | List or search (name, category, exact ID) |
| POST | /api/products | Add product |
| PUT | /api/products/<id> | Set quantity and/or price |
| PATCH | /api/products/<id>/adjust | Change stock by +/- amount |
| DELETE | /api/products/<id> | Delete product |

## Edge cases tested
- Search with no match -> empty list, message in UI
- Reduce stock below zero -> 400, stock unchanged
- Negative / blank / text quantity or price -> 400
- Update or delete unknown ID -> 404
