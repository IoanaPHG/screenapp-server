# ScreenApp Project Overview

## Ce este proiectul

ScreenApp este o aplicatie de remote support construita in jurul a trei componente:

- un server Node.js pentru signaling si coordonare
- o interfata web/desktop pentru sesiuni remote
- o aplicatie Electron care permite screen sharing si control remote real pe Windows

Scopul proiectului este sa ofere un flux simplu de tip TeamViewer/AnyDesk:

- utilizatorul intra in aplicatie cu numele lui
- vede participantii online
- cere acces la calculatorul altei persoane
- persoana tinta accepta sau refuza
- daca accepta, porneste sesiunea cu:
  - vizualizare ecran
  - control mouse
  - control tastatura
  - scroll

## Componentele proiectului

### 1. Serverul de signaling

Fisier principal:

- [server.js](/c:/ScreenApp/server.js)

Rolul serverului:

- primeste conexiuni WebSocket
- tine evidenta utilizatorilor conectati
- tine evidenta participantilor din camera comuna
- redirectioneaza mesaje de signaling WebRTC
- redirectioneaza evenimente de control remote
- serveste si pagina principala a aplicatiei
- expune endpointul JWT

Tehnologii:

- `http`
- `ws`
- `jsonwebtoken`

Functionalitati existente:

- `POST /api/token`
- `join`
- `participants`
- `access-request`
- `access-approved`
- `access-denied`
- `offer`
- `answer`
- `ice`
- `remote-mouse`
- `remote-keyboard`
- `remote-scroll`
- `control-revoked`
- `stop-share`

Serverul ruleaza pe:

- `process.env.PORT || 3001`
- `0.0.0.0`

Deploy:

- Render

## 2. Clientul principal

Fisier principal:

- [public/index.html](/c:/ScreenApp/public/index.html)

Clientul include:

- UI-ul aplicatiei
- logica WebSocket
- logica WebRTC
- controlul sesiunii
- lista participantilor
- fluxul de cerere/accept acces

Functionalitati existente:

- introducerea numelui la intrare
- intrare in camera fixa interna `screenapp`
- afisarea participantilor online
- trimiterea unei cereri de acces catre alt participant
- confirmare pe calculatorul destinatie
- pornirea automata a sesiunii dupa accept
- viewer video pentru ecranul remote
- trimitere evenimente:
  - mouse
  - tastatura
  - scroll
- oprirea sesiunii

Imbunatatiri de UI existente:

- `Focus Mode`
- `Full Screen`
- `Fit / Fill`
- buton rapid `Ascunde detalii`

## 3. Aplicatia Electron

Fisiere principale:

- [electron/main.js](/c:/ScreenApp/electron/main.js)
- [electron/preload.js](/c:/ScreenApp/electron/preload.js)
- [electron/agent-client.js](/c:/ScreenApp/electron/agent-client.js)
- [electron/remote-control.js](/c:/ScreenApp/electron/remote-control.js)

Rolul Electron:

- ruleaza aplicatia ca desktop app
- permite capture reala de ecran
- conecteaza UI-ul la partea nativa
- executa comenzi remote de mouse/tastatura/scroll prin agent local

Electron este necesar pentru:

- control remote real
- integrare nativa pe Windows
- build `.exe`

## 4. Agentul nativ Windows

Folder relevant:

- [agent](/c:/ScreenApp/agent)

Scopul agentului:

- executa input-ul remote la nivel local
- este folosit de Electron pentru actiuni reale pe sistem

Tipuri de actiuni deja conectate in proiect:

- mouse move
- mouse down
- mouse up
- click
- dublu click
- click dreapta
- tastatura
- scroll

## Cum circula datele

### Signaling si control

Aceste date merg prin WebSocket, prin serverul Render:

- join
- participants
- access-request / approved / denied
- offer / answer / ice
- remote-mouse
- remote-keyboard
- remote-scroll
- stop-share
- control-revoked

Formatul este JSON.

### Video-ul efectiv

Video-ul nu trece prin server.

Video-ul merge prin WebRTC, direct intre cei doi participanti.

Flux:

1. utilizatorul accepta cererea
2. host-ul porneste `getDisplayMedia()`
3. stream-ul este adaugat in `RTCPeerConnection`
4. se trimit `offer`, `answer`, `ice`
5. conexiunea WebRTC este stabilita
6. viewer-ul vede ecranul remote

### Controlul remote

Viewer-ul trimite prin WebSocket evenimente de input:

- coordonate mouse
- buton mouse
- taste
- scroll

Pe calculatorul controlat:

- Electron primeste mesajele
- agentul local le executa pe Windows

## Fluxul actual al utilizatorului

1. utilizatorul deschide aplicatia
2. isi introduce numele
3. se conecteaza in camera comuna interna
4. vede participantii online
5. selecteaza persoana la care doreste acces
6. trimite cererea
7. persoana tinta primeste intrebarea de accept/refuz
8. daca accepta:
   - porneste share screen
   - porneste viewer-ul
   - se activeaza controlul remote

## Functionalitati implementate pana acum

- server WebSocket minimal
- endpoint HTTP pentru JWT
- suport Render
- WebRTC signaling
- camere si apoi simplificare la o singura camera comuna
- lista participanti online
- access request / access approve / access deny
- screen sharing
- viewer remote
- control remote de baza
- Electron desktop app
- build `.exe`
- portable `.exe`
- layout mai prietenos pentru viewer
- mod focus
- fullscreen

## Ce merge in acest moment

- conectarea la server
- afisarea participantilor online
- trimiterea cererii de acces
- acceptarea cererii
- pornirea sesiunii
- afisarea ecranului remote
- control remote de baza
- rulare ca `.exe`

## Limitari actuale

- controlul remote poate avea nevoie de rafinare pentru stabilitate maxima
- daca PC-ul remote este oprit complet, accesul nu mai este posibil
- aplicatia nu are inca pornire automata cu Windows
- nu exista inca un agent persistent complet in fundal
- nu exista inca suport complet de tip enterprise:
  - multi-monitor avansat
  - clipboard sync
  - transfer fisiere
  - reconectare inteligenta
  - autentificare avansata
  - permisiuni detaliate pe roluri

## Ce ar fi urmatorii pasi buni

### Stabilitate

- rafinarea mouse-ului
- rafinarea tastaturii
- mai putine pierderi de focus
- reconnect mai bun

### Experienta de utilizare

- pornire automata cu Windows
- agent in background
- sesiune mai apropiata de TeamViewer/AnyDesk
- bara de control compacta
- mod viewer si mai curat

### Acces cand utilizatorul nu este in app

Pentru un comportament mai apropiat de TeamViewer:

- agent care porneste automat cu Windows
- aplicatie care ramane activa in fundal
- acceptarea sesiunii chiar daca UI-ul principal nu este in fata
- optional `Wake-on-LAN` daca hardware-ul permite

Important:

- daca PC-ul este oprit complet, nu exista acces remote fara mecanisme externe de pornire

## Comenzi utile

### Pornire locala server/app

```cmd
cd /d C:\ScreenApp
npm.cmd start
```

### Pornire desktop app

```cmd
cd /d C:\ScreenApp
npm.cmd run desktop
```

### Build portable exe

```cmd
cd /d C:\ScreenApp
npm.cmd run dist:portable
```

### Build installer/setup

```cmd
cd /d C:\ScreenApp
npm.cmd run dist:setup
```

### Deploy source

```cmd
cd /d C:\ScreenApp
git add .
git commit -m "Update app"
git push
```

## Observatii importante

- Pentru control remote real, ambele parti ar trebui sa foloseasca varianta Electron / `.exe`
- Serverul de pe Render este folosit pentru signaling si coordonare, nu pentru transportul video
- Video-ul este transportat direct intre participanti prin WebRTC
- Build-ul nou trebuie copiat din nou pe celalalt calculator dupa fiecare schimbare importanta

## Rezumat scurt

Proiectul este acum un MVP functional de remote support:

- are server propriu
- are lista de participanti
- are cerere si accept acces
- are screen sharing
- are control remote
- are desktop app `.exe`

Urmatoarea etapa naturala este sa devina mai stabil, mai automat si mai apropiat de un produs real de remote desktop.
