const puppeteer = require("puppeteer");

(async () => {
  // Inicia o navegador
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // URL da página do Facebook
  const url = "https://www.facebook.com/NASA"; // Substitua pelo URL da página 

  // Abre a página
  await page.goto(url, { waitUntil: "networkidle2" });

  // Função para realizar scroll down até encontrar o elemento desejado
  const scrollUntilElement = async (page, selector) => {
    let element = null;
    while (!element) {
      element = await page.$(selector); // Verifica se o elemento está presente
      if (!element) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight); // Rola a página para baixo
        });
        await page.waitForTimeout(1000); // Espera 1 segundo para a próxima verificação
      }
    }
    return element;
  };

  // Realiza scroll down até encontrar o <div aria-posinset>
  await scrollUntilElement(page, 'div[aria-posinset]');

  // Extrai o conteúdo do elemento encontrado e converte para JSON
  const content = await page.evaluate(() => {
    const element = document.querySelector('div[aria-posinset]');
    if (element) {
      return {
        textContent: element.textContent,
      };
    }
    return null;
  });

  console.log(content); // Exibe o conteúdo capturado em JSON

  // Fecha o navegador
  // await browser.close();
})();