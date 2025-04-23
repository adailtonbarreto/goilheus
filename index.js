// index.js
// 1) Imports e setup do Express
const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');
const axios = require('axios');
const { getState, setState, clearState } = require('./state');

const app = express();
const PORT = process.env.PORT || 3000;

// Armazena o último QR gerado em base64
let ultimaQrBase64 = null;

// 2) Health-check para manter o container acordado
app.get('/', (_req, res) => {
  res.send('🤖 Bot GoIlheus está UP');
});

// 3) Rota para ver o QR Code no navegador
app.get('/qr', (_req, res) => {
  if (!ultimaQrBase64) {
    return res.status(404).send('QR ainda não gerado');
  }
  res.send(`
    <html>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh">
        <img src="${ultimaQrBase64}" style="max-width:90%;height:auto" />
      </body>
    </html>
  `);
});

// 4) Inicia o servidor web
app.listen(PORT, () => {
  console.log(`⚡️ Webservice rodando em :${PORT}`);
});

// 5) Constantes do bot
const CATEGORIAS_POR_PAGINA = 5;
const API_URL = 'https://vilela24horas.com.br/api.php';

// 6) Inicializa o WPPConnect
wppconnect
  .create({
    session: 'go-ilheus',
    catchQR: (base64Qrimg, asciiQR) => {
      ultimaQrBase64 = base64Qrimg;
      console.log(asciiQR);
    },
    browserless: true,        // ESSENCIAL!
    disableWelcome: true,
    disableSpins: true,
    popup: false,
  })
  .then((client) => start(client))
  .catch((error) => console.error('Erro ao iniciar o bot:', error));

// 7) Função principal de recebimento de mensagens
async function start(client) {
  client.onMessage(async (message) => {
    const from = message.from;
    const text = message.body.trim().toLowerCase();
    const state = getState(from);

    if (text === 'menu') {
      clearState(from);
      await client.sendText(
        from,
        `👋 *Seja bem-vindo ao Go Ilhéus!* Seu guia mais completo de empresas da cidade.\n\nDigite:\n1️⃣ *Buscar empresa por nome*\n2️⃣ *Buscar por categorias*`
      );
      setState(from, { step: 'menu' });
      return;
    }

    if (!state.step) {
      await client.sendText(
        from,
        `👋 *Seja bem-vindo ao Go Ilhéus!* Seu guia mais completo de empresas da cidade.\n\nDigite:\n1️⃣ *Buscar empresa por nome*\n2️⃣ *Buscar por categorias*`
      );
      setState(from, { step: 'menu' });
      return;
    }

    if (state.step === 'menu') {
      if (text.includes('1')) {
        setState(from, { step: 'buscarPorNome' });
        return await client.sendText(from, `🔎 Digite o nome da empresa que deseja buscar:`);
      } else if (text.includes('2')) {
        return await mostrarCategorias(client, from);
      } else {
        return await client.sendText(from, '❌ Opção inválida. Digite *1* ou *2* para continuar.');
      }
    }

    if (state.step === 'buscarPorNome') {
      try {
        const { data: results } = await axios.get(API_URL, {
          params: { action: 'buscarPorNome', q: text }
        });

        if (results.length > 0) {
          const lista = results.map((e, i) => `${i + 1}. ${e.nome}`).join('\n');
          await client.sendText(
            from,
            `🔍 *Empresas encontradas:*\n\n${lista}\n\nDigite o número ou nome da empresa para ver os detalhes.`
          );
          setState(from, { step: 'selecionarEmpresa', empresas: results });
        } else {
          const { data: cats } = await axios.get(API_URL, {
            params: { action: 'categorias' }
          });

          const categoriasLimpa = cats
            .slice(0, CATEGORIAS_POR_PAGINA)
            .map((c) => c.categoria);
          const lista = categoriasLimpa.map((c, i) => `${i + 1}. ${c}`).join('\n');

          await client.sendText(
            from,
            `⚠️ Nenhuma empresa encontrada com esse nome.\n\n📚 *Categorias disponíveis:*\n${lista}\n\nDigite o número ou nome de uma categoria para buscar por ela.`
          );
          setState(from, { step: 'categorias', categorias: categoriasLimpa });
        }
      } catch (err) {
        console.error(err);
        await client.sendText(from, '❌ Erro ao buscar empresas. Tente novamente.');
      }
      return;
    }

    if (state.step === 'categorias') {
      const categorias = state.categorias || [];
      const escolha = parseInt(text);
      let categoriaSelecionada = null;

      if (!isNaN(escolha) && escolha >= 1 && escolha <= categorias.length) {
        categoriaSelecionada = categorias[escolha - 1];
      } else {
        const match = categorias.find((c) => c.toLowerCase() === text);
        if (match) categoriaSelecionada = match;
      }

      if (categoriaSelecionada) {
        try {
          const { data: empresas } = await axios.get(API_URL, {
            params: { action: 'buscarPorCategoria', q: categoriaSelecionada }
          });

          if (empresas.length > 0) {
            const lista = empresas.map((e, i) => `${i + 1}. ${e.nome}`).join('\n');
            await client.sendText(
              from,
              `📦 *Empresas na categoria "${categoriaSelecionada}":*\n\n${lista}\n\nDigite o número ou nome da empresa para ver os detalhes.`
            );
            setState(from, { step: 'selecionarEmpresa', empresas });
          } else {
            await client.sendText(from, `❌ Nenhuma empresa encontrada nesta categoria.`);
            clearState(from);
          }
        } catch (err) {
          console.error(err);
          await client.sendText(from, '❌ Erro ao buscar empresas da categoria.');
        }
      } else {
        await client.sendText(
          from,
          '❌ Categoria inválida. Digite o número ou nome exato da categoria listada.'
        );
      }
      return;
    }

    if (state.step === 'selecionarEmpresa') {
      const lista = state.empresas || [];
      const escolha = parseInt(text);
      let empresa = null;

      if (!isNaN(escolha) && escolha >= 1 && escolha <= lista.length) {
        empresa = lista[escolha - 1];
      } else {
        empresa = lista.find((e) => e.nome.toLowerCase() === text);
      }

      if (empresa) {
        await enviarDadosEmpresa(client, from, empresa);
        clearState(from);
      } else {
        await client.sendText(from, '❌ Empresa inválida. Digite o número ou nome exato da lista.');
      }
      return;
    }
  });
}

// 8) Função para mostrar categorias
async function mostrarCategorias(client, from) {
  try {
    const { data: rows } = await axios.get(API_URL, {
      params: { action: 'categorias' }
    });
    const categorias = rows.map((r) => r.categoria);
    const lista = categorias
      .slice(0, CATEGORIAS_POR_PAGINA)
      .map((c, i) => `${i + 1}. ${c}`)
      .join('\n');

    await client.sendText(
      from,
      `📚 *Categorias disponíveis:*\n${lista}\n\nDigite o número ou nome da categoria desejada.`
    );
    setState(from, { step: 'categorias', categorias: categorias.slice(0, CATEGORIAS_POR_PAGINA) });
  } catch (err) {
    console.error(err);
    await client.sendText(from, '❌ Erro ao buscar categorias. Tente novamente.');
  }
}

// 9) Função para enviar dados da empresa
async function enviarDadosEmpresa(client, to, e) {
  const whatsapp = e.whatsapp ? `(https://wa.me/${e.whatsapp.replace(/\D/g, '')})` : 'Não informado';
  const instagram = e.instagram ? `(https://instagram.com/${e.instagram.replace('@', '')})` : 'Não informado';
  const site = e.site ? `(${e.site})` : 'Não informado';

  const info = `
📌 *${e.nome}*
📍 *Endereço:* ${e.endereco || 'Não informado'}
📞 *Telefone:* ${e.telefone || 'Não informado'}
📱 *WhatsApp:* ${whatsapp}
📸 *Instagram:* ${instagram}
🌐 *Site:* ${site}
📝 *Descrição:* ${e.descricao || 'Não disponível'}
  `.trim();

  if (e.imagem) {
    try {
      await client.sendImage(to, e.imagem, 'empresa.jpg', '');
    } catch (err) {
      console.log('Erro ao enviar imagem:', err);
    }
  }

  await client.sendText(to, info);
  await client.sendText(to, '✅ Obrigado por usar o *Go Ilhéus*! Caso queira fazer outra busca, digite *menu*.');
  clearState(to);
}
