# GoofyASchach ♞💣

Chaos-Schach für dich und deine Freunde im Browser, gehostet auf GitHub Pages.

## Spielen
1. Seite öffnen und **Raum erstellen** klicken.
2. Den Link oder den 5-stelligen Code an deinen Freund schicken.
3. Der Freund öffnet den Link (oder gibt den Code ein). Fertig: Du spielst Weiß, er Schwarz.

Alternativ: **Lokal an einem Gerät spielen**.

## Chaos-Modus
- Für jeden Zug gibt es +1 🪙, für geschlagene Figuren ihren Wert (Bauer 1, Springer/Läufer 3, Turm 5, Dame 9).
- Im **Shop** kannst du pro Zug eine Fähigkeit kaufen: Zug-Skip, Blitz, Bombe, Mutation, Erdbeben, Tornado, Bauern-Armee.
- Alle 4 Halbzüge passiert ein **Chaos-Event**: Meteoriten, Lava, Eis, Brett-Drehung, doppelte Punkte, Bauern-Sturm, Platztausch, Geschenk, Mutations-Welle, Erdbeben.
- Gewonnen hat, wer den gegnerischen **König schlägt**.

## Technik
Reines HTML/CSS/JavaScript ohne Build-Schritt. Die Online-Verbindung läuft direkt von Browser zu Browser über [PeerJS](https://peerjs.com); der Raum-Ersteller berechnet das Spiel. Sounds werden mit der Web Audio API erzeugt.
