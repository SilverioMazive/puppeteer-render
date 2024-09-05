const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
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
    const loginStatus = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const loginFailed = bodyText.includes('Invalid username or password');
      const captchaPresent = bodyText.includes('Please enter the characters you see');
      const twoFactorPresent = bodyText.includes('Enter the code from your Authenticator app');
      
      return {
        loginFailed,
        captchaPresent,
        twoFactorPresent,
        bodyText,
      };
    });

    if (loginStatus.loginFailed) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    } else if (loginStatus.captchaPresent) {
      return res.status(401).json({ message: 'CAPTCHA necessário' });
    } else if (loginStatus.twoFactorPresent) {
      return res.status(401).json({ message: 'Autenticação de dois fatores necessária' });
    } else if (page.url().includes('facebook.com/login') || page.url().includes('checkpoint')) {
      return res.status(401).json({ message: 'Falha no login ou verificação adicional necessária', verificationMessage: loginStatus.bodyText });
    }

    res.json({ message: 'Login bem-sucedido' });
  } catch (error) {
    res.status(500).json({ message: 'Erro no login', error: error.message });
  }
});

// Endpoint para capturar o HTML da página de login
app.get('/login-html', async (req, res) => {
  if (!browser) await initBrowser();

  try {
    page = await browser.newPage();
    await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });

    // Captura o HTML completo da página
    const pageContent = await page.content();
    
    res.send(pageContent);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao capturar HTML da página de login', error: error.message });
  }
});


// Endpoint para capturar a tela da página de login e armazenar em uma pasta
app.get('/login-screenshot', async (req, res) => {
  if (!browser) await initBrowser();

  try {
    page = await browser.newPage();
    await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });

    // Cria a pasta 'uploads' se não existir
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    // Gera um nome de arquivo único para evitar sobrescrever arquivos
    const filename = `login-screenshot-${Date.now()}.png`;
    const filepath = path.join(uploadDir, filename);

    // Salva a captura de tela na pasta 'uploads'
    await page.screenshot({ path: filepath });

    // Retorna a URL para acessar a imagem
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    res.json({ message: 'Captura de tela salva com sucesso', imageUrl });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao capturar a tela da página de login', error: error.message });
  }
});

// Servir arquivos da pasta 'uploads' como estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Scrape
app.get('/scrape', async (req, res) => {
  if (!page) return res.status(400).json({ message: 'Sessão não iniciada' });

  const query = req.body.q || 'Eleicoes em mocambique';
  const filters = req.body.filters || 'eyJyZWNlbnRfcG9zdHM6MCI6IntcIm5hbWVcIjpcInJlY2VudF9wb3N0c1wiLFwiYXJnc1wiOlwie1xcXCJzdGFydF95ZWFyXFxcIjpcXFwiMjAyNFxcXCIsXFxcInN0YXJ0X21vbnRoXFxcIjpcXFwiMjAyNC0xXFxcIixcXFwiZW5kX3llYXJcXFxcIjpcXFwiMjAyNFxcXCIsXFxcImVuZF9tb250aFxcXCI6XFxcIjIwMjRcXFwiLFxcXCJzdGFydF9kYXlcXFwiOlxcXCIyMDI0LTFcXFwiLFxcXCJlbmRfZGF5XFxcIjpcXFwiMjAyNC0xMi0zMVxcXCJ9XFwifSJ9';

  try {
    const searchUrl = `https://web.facebook.com/search/posts?q=${encodeURIComponent(query)}&filters=${encodeURIComponent(filters)}`;

    await page.goto(searchUrl.toString(), { waitUntil: 'networkidle2', timeout: 60000 });

    const scrollAndWait = async (page, timeout = 10000) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, timeout));
    };
    
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
