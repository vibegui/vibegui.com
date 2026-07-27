---
slug: a-evolucao-da-plataforma-como-agentes-de-ia-podem-eliminar-erros-em-producao
title: "A Evolução da Plataforma: Como Agentes de IA Podem Eliminar Erros em Produção"
description: "Como agentes com acesso ao contexto real do produto podem investigar e corrigir erros em produção."
date: 2025-09-11
status: published
locale: pt-BR
translationKey: "linkedin:7371884584998727680"
originalUrl: "https://www.linkedin.com/posts/vibegui_normalmente-uma-startup-escreve-o-c%C3%B3digo-activity-7371884584998727680-qNPb"
coverImage: null
tags:
  - agents
  - ai
  - debugging
  - linkedin-import
  - mcp
---
Normalmente, uma startup escreve o código de seu produto, e ele é utilizado pelos seus clientes diretamente. A deco, entretanto, é uma plataforma. Isso quer dizer que a gente escreve o código de uma "base", sobre a qual nossos clientes escrevem o código deles. 

Quem já operou uma plataforma sabe que rodar código de usuários é um desafio imenso dado que você não controla o que vai subir em produção. 

Há uns dois meses atrás, ao declarar o futuro do deco.day, nós tivemos uma distinção poderosa: não podemos anunciar uma evolução da plataforma pra workflows e agentes de IA enquanto nossos clientes em produção estão sofrendo com erros. 

Se os erros são no código dele, se foi escrito por ele ou por uma agência: não importa. Nossa responsabilidade é fazer uma infraestrutura e um ferramental que IMPEÇAM nossos usuários de colocar erros em produção.

Então, eu fiz o que qualquer founder obsessivo faria e comecei a *manualmente* corrigir os "top errors" do nosso dashboard (que é uma feature integrada da deco, claro - todo site tem logs completos de erro, acessível pros usuários). Também contei com a ajuda dos gênios do time, especialmente o herói Guilherme Tavano, que conhece profundamente as nuances do nosso framework. 

Manualmente significa: 
- Acha um erro com alta frequência
- Copia o stack trace
- Pega o nome da loja
- Clona o repositório do nosso GitHub centralizado (hosteamos o código de todos os nossos clientes de forma privada, o que nos permite colaborar com eles muito mais facilmente, também.)
- Roda local e reproduz o erro
- Manda o Claude Code ou Cursor (experimentei bastante entre eles, estou especialmente feliz com Cursor+GPT-5) olharem o código e o stack trace e propor um fix.
- 60% das vezes ele achava one-shot o problema, 
- 30% das vezes era só atualizar uma dep da deco, 
- 10% das vezes eu tinha que parar pra pensar e dar um contexto melhor, eventualmente adicionando nossas docs relevantes.

Mas eu não estava fazendo isso (apenas) para pagar os meus pecados (lembrando que os erros estão no código do nosso cliente). Eu fiz isso para ir automatizando as peças necessárias para que AGENTES DE IA possam fazer isso por mim, e pelos meus clientes e parceiros, para todo sempre.

Além do resultado tático desse print de 28 dias do nosso dash, nós criamos os MCPs pro sistema de logs que permite aos agentes da deco olharem os erros em realtime e propor mudanças no código. 

Se você quiser ver uma demo de um agent vendo o log, resolvendo o erro e subindo o fix, deixei o link da demo do Tavano nos comentários.

Vocês não tem ideia do salto de qualidade que o código da humanidade vai sofrer nos próximos 2 anos. Software bugado vai ser uma coisa que vamos contar com saudosismo. Lembra quando acordávamos de manhã com um bug em produção por que subiu um código errado? KKKK

Bons tempos!
