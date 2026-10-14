import os, tempfile, app as a

a.DB_PATH = os.path.join(tempfile.mkdtemp(), "t.db")
a.init_db()
c = a.app.test_client()

def check(label, cond):
    print(("PASS" if cond else "FAIL"), "-", label)
    assert cond

r = c.post("/api/products", json={"name": "Pen", "category": "Stationery", "quantity": 10, "price": 2.5})
check("add product", r.status_code == 201)
pid = r.get_json()["id"]
check("negative quantity rejected", c.post("/api/products", json={"name": "X", "category": "Y", "quantity": -1, "price": 1}).status_code == 400)
check("negative price rejected", c.post("/api/products", json={"name": "X", "category": "Y", "quantity": 1, "price": -5}).status_code == 400)
check("text quantity rejected", c.post("/api/products", json={"name": "X", "category": "Y", "quantity": "abc", "price": 1}).status_code == 400)
check("blank name rejected", c.post("/api/products", json={"name": " ", "category": "Y", "quantity": 1, "price": 1}).status_code == 400)
check("search by name", len(c.get("/api/products?q=pen").get_json()) == 1)
check("search by category", len(c.get("/api/products?q=station").get_json()) == 1)
check("search by id", len(c.get("/api/products?q=%d" % pid).get_json()) == 1)
check("search unavailable -> empty", c.get("/api/products?q=zzz").get_json() == [])
r = c.patch(f"/api/products/{pid}/adjust", json={"change": -11})
check("stock below zero blocked", r.status_code == 400 and c.get("/api/products").get_json()[0]["quantity"] == 10)
r = c.patch(f"/api/products/{pid}/adjust", json={"change": -6})
check("reduce to 4 -> low stock flag", r.get_json()["low_stock"] is True)
check("update price", c.put(f"/api/products/{pid}", json={"price": 3}).get_json()["price"] == 3)
check("update unknown id -> 404", c.put("/api/products/999", json={"price": 3}).status_code == 404)
check("delete", c.delete(f"/api/products/{pid}").status_code == 200)
check("delete again -> 404", c.delete(f"/api/products/{pid}").status_code == 404)
print("ALL TESTS PASSED")
