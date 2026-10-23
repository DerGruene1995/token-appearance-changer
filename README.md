# Token Appearance Changer

Foundry-VTT-Modul (v12 und v13): Rechtsklick auf ein Token → im Token-HUD erscheint rechts ein Paletten-Button. Er öffnet einen Dialog, in dem du Folgendes änderst:

- **Bild**: per Dateibrowser oder per Klick in der Galerie mit Bildern aus demselben Ordner
- **Färbung**: Tint
- **Deckkraft**
- **Bildskalierung**
- **Spiegelung**: horizontal und vertikal
- **Größe**: Breite und Höhe in Feldern
- optional **Speichern im Prototyp-Token** des Akteurs

Über **Auf Prototyp zurücksetzen** stellst du das Standard-Aussehen des Akteurs wieder her.

## Installation

1. Kopiere den Ordner `token-appearance-changer` nach
   `%LOCALAPPDATA%\FoundryVTT\Data\modules\`
   (oder in den Datenordner deiner Foundry-Installation).
2. Starte Foundry neu und aktiviere das Modul in der Welt unter **Module verwalten**.

## Hinweise

- Der Button erscheint nur für Spieler, denen das Token gehört, und für die Spielleitung.
- Die Galerie wird nur angezeigt, wenn der Benutzer Dateien durchsuchen darf (Berechtigung „Dateien durchsuchen“).
