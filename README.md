# GoofyASchach

Chaos-Schach für 2–4 Freunde im Browser, gehostet auf GitHub Pages.

## Spielen
1. Seite öffnen, Namen eingeben, **Raum erstellen**.
2. Link oder 5-stelligen Code an bis zu drei Freunde schicken.
3. Wenn alle drin sind, drückt der Host **Spiel starten**.

Mit 2 Spielern wird auf dem normalen 8×8-Brett gespielt, mit 3–4 auf dem 14×14-Kreuzbrett. Jeder sieht seine eigene Armee unten. Mit 4 Spielern geht auch **2 gegen 2** (gegenüberliegende Spieler sind ein Team). Man kann auch lokal an einem Gerät spielen.

Wer die Verbindung verliert, wird automatisch neu verbunden (oder öffnet den Link erneut) und landet wieder auf seinem Platz. Lädt der Host die Seite neu, kann er das laufende Spiel fortsetzen.

## Regeln im Chaos-Modus
- Wer einen König schlägt, wirft den Spieler raus und **übernimmt seine ganze Armee**. Der letzte König (bzw. das letzte Team) gewinnt.
- Punkte: +1 pro Zug, Figurenwert fürs Schlagen (Bauer 1, Springer/Läufer 3, Turm 5, Dame 9). **Zug passen** bringt +3.
- Pro Zug eine Fähigkeit aus dem Shop (19 Stück): Zug-Skip, Blitz, Bombe, Kamikaze, Teleport, Schild, Freeze, Klon, Mutation, Taschendieb, Erdbeben, Tornado, Bauern-Armee, Sniper, Kettenblitz, Gift, Beförderung, Wiederbelebung, Platztausch.
- Fähigkeiten können Könige nicht direkt töten. Im Extra-Zug nach einem **Zug-Skip** darf kein König geschlagen werden, und Skip lässt sich nicht stapeln.
- Alle zwei Runden ein **Chaos-Event**: Meteoriten, Lava, Eis, Brett-Drehung, doppelte Punkte, Bauern-Sturm, Platztausch, Geschenk, Mutations-Welle, Erdbeben, Frost.
- Oder ein **Regel-Event**, das ein paar Züge lang gilt: Rückwärts-Bauern, Springer-Fieber, Geister-Modus, Friedenszeit, Königs-Sprint, Ausverkauf.
- Am Ende gibt es eine **Statistik** mit Auszeichnungen.

Im klassischen Modus mit 2 Spielern gilt normales Schach mit Schachmatt.

## Technik
Reines HTML/CSS/JavaScript ohne Build-Schritt. Die Verbindung läuft direkt von Browser zu Browser über [PeerJS](https://peerjs.com); der Raum-Ersteller berechnet das Spiel. Sounds werden mit der Web Audio API erzeugt.
