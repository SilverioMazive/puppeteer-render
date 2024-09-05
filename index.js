const express = require('express');
const puppeteer = require('puppeteer');
require('dotenv').config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 4000;

let browser;
let page;

// Inicializar o Puppeteer e o navegador
const initBrowser = async () => {
  browser = await puppeteer.launch({ headless: true });
};

app.get('/teste', async (req, res) => {
  res.json({ message: 'Testado com sucesso!' });
});

// // Endpoint para login
// app.post('/login', async (req, res) => {
//   if (!browser) await initBrowser();

//   page = await browser.newPage();
//   const { email, password } = req.body;

//   try {
//     await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });
//     await page.type('#email', email);
//     await page.type('#pass', password);
//     await page.click('[name="login"]');
//     await page.waitForNavigation({ waitUntil: 'networkidle2' });

//     if (page.url().includes('facebook.com/login') || page.url().includes('checkpoint')) {
//       return res.status(401).json({ message: 'Falha no login ou verificação adicional necessária' });
//     }

//     res.json({ message: 'Login bem-sucedido' });
//   } catch (error) {
//     res.status(500).json({ message: 'Erro no login', error: error.message });
//   }
// });

// Endpoint para login
app.post('/login', async (req, res) => {
  if (!browser) await initBrowser();

  page = await browser.newPage();
  const { email, password } = req.body;

  try {
    await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });
    await page.type('#email', email);
    await page.type('#pass', password);
    await page.click('[name="login"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Verifica se houve falha no login ou se há uma verificação adicional necessária
    if (page.url().includes('facebook.com/login') || page.url().includes('checkpoint')) {
      // Captura o texto de qualquer elemento que possa conter a mensagem de verificação
      const verificationMessage = await page.evaluate(() => {
        // Tenta encontrar o texto de verificação comum
        const element = document.querySelector('body');
        return element ? element.innerText : 'Verificação adicional necessária, mas não foi possível identificar a mensagem específica.';
      });

      return res.status(401).json({ message: 'Falha no login ou verificação adicional necessária', verificationMessage });
    }

    res.json({ message: 'Login bem-sucedido' });
  } catch (error) {
    res.status(500).json({ message: 'Erro no login', error: error.message });
  }
});


// Endpoint para scraping
app.get('/scrape', async (req, res) => {
  if (!page) return res.status(400).json({ message: 'Sessão não iniciada' });

  const query = req.body.q || 'Eleicoes em mocambique';
  const filters = req.body.filters || 'eyJyZWNlbnRfcG9zdHM6MCI6IntcIm5hbWVcIjpcInJlY2VudF9wb3N0c1wiLFwiYXJnc1wiOlwiXCJ9IiwicnBfY3JlYXRpb25fdGltZTowIjoie1wibmFtZVwiOlwiY3JlYXRpb25fdGltZVwiLFwiYXJnc1wiOlwie1xcXCJzdGFydF95ZWFyXFxcIjpcXFwiMjAyNFxcXCIsXFxcInN0YXJ0X21vbnRoXFxcIjpcXFwiMjAyNC0xXFxcIixcXFwiZW5kX3llYXJcXFwiOlxcXCIyMDI0XFxcIixcXFwiZW5kX21vbnRoXFxcIjpcXFwiMjAyNC0xMlxcXCIsXFxcInN0YXJ0X2RheVxcXCI6XFxcIjIwMjQtMS0xXFxcIixcXFwiZW5kX2RheVxcXCI6XFxcIjIwMjQtMTItMzFcXFwifVwifSJ9';

  try {
    const searchUrl = `https://web.facebook.com/search/posts?q=${encodeURIComponent(query)}&filters=${encodeURIComponent(filters)}`;

    await page.goto(searchUrl.toString(), { waitUntil: 'networkidle2' });

    const scrollAndWait = async (page, timeout = 10000) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, timeout));
    };
 

    // Para fazer um scroll
    await scrollAndWait(page);

    const posts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div[aria-posinset]')).map((post, index) => {
        return {
          id: index + 1,
          content: post.innerText.trim().split('\n').map(text => text.trim()).filter(Boolean)
        };
      });
    });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao executar o scraping', error: error.message });
  }
});

// Endpoint para logout
app.post('/logout', async (req, res) => {
  if (!browser) return res.status(400).json({ message: 'Navegador não iniciado' });

  try {
    await browser.close();
    browser = null;
    page = null;
    res.json({ message: 'Sessão encerrada com sucesso.' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao encerrar a sessão', error: error.message });
  }
});

// Endpoint para fechar a aba atual
app.post('/close-tab', async (req, res) => {
  if (!page) return res.status(400).json({ message: 'Não há aba ativa para fechar.' });

  try {
    await page.close();
    page = null;
    res.json({ message: 'Aba fechada com sucesso.' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao fechar a aba', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor ouvindo na porta ${PORT}`);
});
