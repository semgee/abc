const data = {
  categories: [
    {
      id: "dessert",
      name: "🍰 甜點",
      products: [
        {
          id: "cake01",
          name: "草莓蛋糕",
          price: "NT$120",
          image: "https://source.unsplash.com/featured/?cake",
          description: "新鮮草莓與綿密蛋糕完美搭配"
        },
        {
          id: "pudding01",
          name: "香草布丁",
          price: "NT$80",
          image: "https://source.unsplash.com/featured/?pudding",
          description: "滑順香草口感，口齒留香"
        }
      ]
    },
    {
      id: "drinks",
      name: "🍹 飲品",
      products: [
        {
          id: "tea01",
          name: "蜂蜜檸檬茶",
          price: "NT$60",
          image: "https://source.unsplash.com/featured/?lemon,tea",
          description: "清爽解渴，適合夏日飲用"
        }
      ]
    }
  ]
};

const main = document.getElementById("main-content");

function renderCategories() {
  main.innerHTML = '';
  data.categories.forEach(category => {
    const div = document.createElement('div');
    div.className = 'category';
    div.innerHTML = `<h2>${category.name}</h2>`;
    div.onclick = () => renderProducts(category.id);
    main.appendChild(div);
  });
}

function renderProducts(categoryId) {
  const category = data.categories.find(c => c.id === categoryId);
  main.innerHTML = `<h2>${category.name}</h2>`;
  category.products.forEach(p => {
    const div = document.createElement('div');
    div.className = 'product';
    div.innerHTML = `
      <img src="${p.image}" alt="${p.name}" />
      <h3>${p.name}</h3>
      <p>${p.price}</p>
    `;
    div.onclick = () => renderProductDetail(categoryId, p.id);
    main.appendChild(div);
  });

  const backBtn = document.createElement('button');
  backBtn.textContent = '← 返回分類';
  backBtn.onclick = renderCategories;
  main.appendChild(backBtn);
}

function renderProductDetail(categoryId, productId) {
  const product = data.categories.find(c => c.id === categoryId).products.find(p => p.id === productId);
  main.innerHTML = `
    <h2>${product.name}</h2>
    <img src="${product.image}" />
    <p>${product.description}</p>
    <p><strong>${product.price}</strong></p>
    <button onclick="renderProducts('${categoryId}')">← 返回商品列表</button>
  `;
}

// 初始化頁面
renderCategories();
