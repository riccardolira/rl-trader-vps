# Proxy Setup on Hostinger

A Hostinger serve o seu site usando conexões seguras (HTTPS).
O seu Backend na VPS está usando uma conexão direta pelo IP via HTTP (Inseguro).
Navegadores modernos (Chrome, Edge, etc) **BLOQUEIAM** qualquer tentativa de um site seguro (HTTPS) falar com um servidor inseguro (HTTP). Isso se chama "Block Mixed Content".

Para resolver isso de forma super rápida e definitiva sem instalar coisas complexas na VPS (como NGINX/Certbot):

## Solução Mais Rápida: Cloudflare Tunnels (Não precisa de domínio extra)
Se você não instalou um painel web na VPS, a forma mais segura e fácil de dar um endereço HTTPS pro seu backend é usar o Cloudflare Tunnel. 

Ou...

## Solução via Hostinger (Se você puder apontar um subdomínio)
Como você já tem o painel na Hostinger, você pode ir no hPanel:
1. Vá em **Gerenciar > Avançado > Editor de Zona DNS**.
2. Crie um registro tipo **A**:
   - Nome: `api` (vai criar api.seudominio.com)
   - Aponta para: `138.59.124.28` (IP da VPS)
3. Na Hostinger não dá para fazer Proxy reverso simples assim de graça para IPs externos.

## Solução Alternativa Definitiva (Certificado direto na VPS):
Podemos rodar o backend usando um Caddy Server ou Ngrok para providenciar o SSL.

---

Eu recomendo que você use **NGROK** provisoriamente ou crie um subdomínio no cloudflare.
Mas como sei que você quer a solução mais prática:

Qual das informações você prefere tentar implementar?
1. Configurar o **NGrok** ou **Cloudflare Tunnel** na VPS para criar um link HTTPS gratuito que aponte para a porta 8001?
2. Nós configuramos um sub-domínio na sua conta Hostinger (`api.seudominio.xyz`) apontando pro IP da VPS, e usamos a ferramenta `Caddy` na VPS para gerar o certificado SSL automaticamente?
