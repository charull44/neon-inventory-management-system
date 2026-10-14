const LOW_STOCK_LIMIT = 5;

const $ = (id) => document.getElementById(id);
const rowsEl = $("rows");

let searchTimer;
let toastTimer;

// ---------- API HELPER ----------

async function api(url, method = "GET", body) {
    const res = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json"
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}


// ---------- HELPERS ----------

function esc(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}

function money(value) {
    return Number(value || 0).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function toast(message, bad = false) {
    const element = $("toast");

    element.textContent = message;
    element.className = "toast show" + (bad ? " bad" : "");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        element.className = "toast";
    }, 2800);
}


// ---------- DASHBOARD STATISTICS ----------

function updateDashboard(products) {
    const totalProducts = products.length;

    const totalUnits = products.reduce(
        (sum, product) => sum + Number(product.quantity || 0),
        0
    );

    const totalValue = products.reduce(
        (sum, product) =>
            sum + Number(product.quantity || 0) *
                  Number(product.price || 0),
        0
    );

    const lowStockProducts = products.filter(
        product => Number(product.quantity) <= LOW_STOCK_LIMIT
    );

    $("totalProducts").textContent =
        totalProducts.toLocaleString("en-IN");

    $("totalUnits").textContent =
        totalUnits.toLocaleString("en-IN");

    $("inventoryValue").textContent = money(totalValue);

    $("lowStock").textContent =
        lowStockProducts.length.toLocaleString("en-IN");

    $("productCount").textContent =
        totalProducts.toLocaleString("en-IN");
}


// ---------- LOAD PRODUCTS ----------

async function loadProducts() {
    const query = $("search").value.trim();

    try {
        const products = await api(
            "/api/products" +
            (query ? `?q=${encodeURIComponent(query)}` : "")
        );

        render(products, query);

        // Calculate statistics from the complete inventory,
        // not just the current search results.
        if (query) {
            const allProducts = await api("/api/products");
            updateDashboard(allProducts);
            showLowStock(allProducts);
        } else {
            updateDashboard(products);
            showLowStock(products);
        }

    } catch (error) {
        toast(error.message, true);
    }
}


// ---------- RENDER INVENTORY ----------

function render(products, query = "") {
    rowsEl.innerHTML = products.map(product => {
        const quantity = Number(product.quantity);
        const price = Number(product.price);

        const low = quantity <= LOW_STOCK_LIMIT;
        const outOfStock = quantity === 0;

        let statusClass = "badge-success";
        let statusText = "In Stock";

        if (outOfStock) {
            statusClass = "badge-danger";
            statusText = "Out of Stock";
        } else if (low) {
            statusClass = "badge-warning";
            statusText = "Low Stock";
        }

        const progressWidth = Math.min(quantity / 50 * 100, 100);

        let progressClass = "";

        if (outOfStock || quantity <= 2) {
            progressClass = "low";
        } else if (low) {
            progressClass = "medium";
        }

        const initial = String(product.name || "?")
            .trim()
            .charAt(0)
            .toUpperCase();

        return `
            <tr class="${low ? "low" : ""}" data-id="${Number(product.id)}">

                <td>
                    <span class="product-id">#${Number(product.id)}</span>
                </td>

                <td>
                    <div class="product-cell">
                        <div class="product-avatar">${esc(initial)}</div>

                        <div>
                            <div class="product-name">${esc(product.name)}</div>
                            <div class="product-subtitle">
                                Product ID ${Number(product.id)}
                            </div>
                        </div>
                    </div>
                </td>

                <td>
                    <span class="category-tag">
                        ${esc(product.category)}
                    </span>
                </td>

                <td>
                    <div class="stock-cell">
                        <span class="stock-number">${quantity}</span>

                        <div class="stock-track">
                            <div
                                class="stock-fill ${progressClass}"
                                style="width:${progressWidth}%"
                            ></div>
                        </div>
                    </div>

                    <span class="badge ${statusClass}">
                        ${statusText}
                    </span>
                </td>

                <td>${esc(money(price))}</td>

                <td>
                    <div class="actions">

                        <button
                            class="ghost"
                            data-act="minus"
                            aria-label="Remove one unit"
                            title="Remove one unit"
                            ${quantity <= 0 ? "disabled" : ""}
                        >−1</button>

                        <button
                            class="ghost"
                            data-act="plus"
                            aria-label="Add one unit"
                            title="Add one unit"
                        >+1</button>

                        <button
                            class="ghost"
                            data-act="edit"
                            title="Edit quantity or price"
                        >Edit</button>

                        <button
                            class="danger"
                            data-act="delete"
                            title="Delete product"
                        >✕</button>

                    </div>
                </td>

            </tr>
        `;
    }).join("");

    const empty = $("empty");

    empty.hidden = products.length > 0;

    if (products.length === 0) {
        empty.innerHTML = `
            <div class="empty-icon">▤</div>
            <h3>${query ? "No matching products" : "Your inventory is empty"}</h3>
            <p>${
                query
                    ? "Try another product name, category, or ID."
                    : "Add your first product using the form below."
            }</p>
        `;
    }
}


// ---------- LOW STOCK ALERT ----------

function showLowStock(products) {
    const lowStockProducts = products.filter(
        product => Number(product.quantity) <= LOW_STOCK_LIMIT
    );

    const alert = $("alert");

    alert.hidden = lowStockProducts.length === 0;

    if (lowStockProducts.length > 0) {
        alert.textContent =
            `⚠ LOW STOCK ALERT — ` +
            lowStockProducts.map(product =>
                `${product.name} (${product.quantity} units)`
            ).join(" · ");
    }
}


// ---------- ADD PRODUCT ----------

$("add-form").addEventListener("submit", async event => {
    event.preventDefault();

    const errorElement = $("form-error");
    const submitButton = $("submitBtn");

    errorElement.textContent = "";

    const body = {
        name: $("name").value.trim(),
        category: $("category").value.trim(),
        quantity: $("quantity").value,
        price: $("price").value
    };

    if (!body.name || !body.category) {
        errorElement.textContent =
            "Product name and category are required.";
        return;
    }

    if (
        body.quantity.trim() === "" ||
        !Number.isInteger(Number(body.quantity)) ||
        Number(body.quantity) < 0
    ) {
        errorElement.textContent =
            "Quantity must be a non-negative whole number.";
        return;
    }

    if (
        body.price.trim() === "" ||
        !Number.isFinite(Number(body.price)) ||
        Number(body.price) < 0
    ) {
        errorElement.textContent =
            "Enter a valid, non-negative price.";
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Adding product...";

    try {
        await api("/api/products", "POST", body);

        event.target.reset();

        toast("✓ Product added successfully!");

        await loadProducts();

        $("inventory").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        errorElement.textContent = error.message;

    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = "<span>＋</span> Add to Inventory";
    }
});


// ---------- INVENTORY ROW ACTIONS ----------

rowsEl.addEventListener("click", async event => {
    const button = event.target.closest("button[data-act]");

    if (!button) return;

    const row = button.closest("tr");

    if (!row) return;

    const id = row.dataset.id;
    const action = button.dataset.act;

    button.disabled = true;

    try {
        if (action === "plus" || action === "minus") {
            const change = action === "plus" ? 1 : -1;

            await api(
                `/api/products/${id}/adjust`,
                "PATCH",
                { change }
            );

            toast(change > 0 ? "✓ Stock increased" : "✓ Stock decreased");

        } else if (action === "edit") {
            const currentQuantity =
                row.querySelector(".stock-number").textContent;

            const currentPriceText =
                row.children[4].textContent;

            const currentPrice =
                Number(currentPriceText.replace(/[₹,\s]/g, ""));

            const quantity = prompt(
                "Enter the new quantity:",
                currentQuantity
            );

            if (quantity === null) return;

            if (
                quantity.trim() === "" ||
                !Number.isInteger(Number(quantity)) ||
                Number(quantity) < 0
            ) {
                toast("Enter a valid non-negative whole quantity.", true);
                return;
            }

            const price = prompt(
                "Enter the new price per unit:",
                currentPrice.toFixed(2)
            );

            if (price === null) return;

            if (
                price.trim() === "" ||
                !Number.isFinite(Number(price)) ||
                Number(price) < 0
            ) {
                toast("Enter a valid non-negative price.", true);
                return;
            }

            await api(`/api/products/${id}`, "PUT", {
                quantity,
                price
            });

            toast("✓ Product updated successfully");

        } else if (action === "delete") {
            const productName =
                row.querySelector(".product-name").textContent;

            if (!confirm(
                `Delete "${productName}" from inventory?\n\nThis action cannot be undone.`
            )) {
                return;
            }

            await api(`/api/products/${id}`, "DELETE");

            toast("✓ Product deleted successfully");
        }

        await loadProducts();

    } catch (error) {
        toast(error.message, true);
        await loadProducts();

    } finally {
        button.disabled = false;
    }
});


// ---------- LIVE SEARCH ----------

$("search").addEventListener("input", () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
        loadProducts();
    }, 250);
});


// ---------- REFRESH ----------

$("refreshBtn").addEventListener("click", async () => {
    const button = $("refreshBtn");

    button.disabled = true;
    button.textContent = "↻ Refreshing...";

    await loadProducts();

    button.disabled = false;
    button.textContent = "↻ Refresh";
});


// ---------- HEADER BUTTON ----------

$("headerAddBtn").addEventListener("click", () => {
    $("add-product").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    setTimeout(() => $("name").focus(), 400);
});


// ---------- INITIAL LOAD ----------

loadProducts();