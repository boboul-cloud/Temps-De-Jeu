# ⚽ Temps De Jeu

Application iOS pour gérer le temps de jeu des joueurs lors des matchs de football. Idéale pour les entraîneurs de clubs amateurs qui veulent assurer une répartition équitable du temps de jeu.

## Fonctionnalités

### 🎮 Gestion du Match
- Chronomètre de match avec gestion des arrêts de jeu
- Suivi en temps réel du temps de jeu de chaque joueur
- Gestion des remplacements par simple glisser-déposer
- Timeline complète des événements (buts, cartons, remplacements)

### 👥 Gestion d'Équipe
- Création et gestion de l'effectif
- Attribution des numéros et positions
- Import/export des joueurs

### 📊 Statistiques
- Temps de jeu par joueur et par match
- Historique des matchs
- Export PDF des compositions et statistiques

### 🔄 Partage de Composition (Cascade)
Système unique pour les clubs avec plusieurs équipes (A, B, C, D...) :
- L'équipe A sélectionne ses joueurs et partage les disponibles à l'équipe B
- L'équipe B fait de même pour l'équipe C, etc.
- Évite les conflits de sélection entre équipes

**Modes de partage :**
- 📄 Fichier `.tdj` - S'ouvre directement dans l'app
- 🔗 Lien iMessage - Cliquable, importe automatiquement
- 📑 PDF - Pour impression ou archivage

## Captures d'écran

*À venir*

## Installation

L'application sera disponible sur l'App Store.

### Développement

Requis :
- Xcode 15+
- iOS 17+

```bash
git clone https://github.com/boboul-cloud/Temps-De-Jeu.git
cd Temps-De-Jeu
open "Temps De Jeu.xcodeproj"
```

## Architecture

```
Temps De Jeu/
├── Models/          # Modèles de données (Player, Match, etc.)
├── ViewModels/      # Logique métier (MatchViewModel)
├── Views/           # Interfaces SwiftUI
├── Services/        # Services (Export, DataManager, etc.)
└── Helpers/         # Utilitaires (TimeFormatters)
```

## Licence

MIT License - Voir [LICENSE](LICENSE)

## Auteur

Robert Oulhen - [@boboul-cloud](https://github.com/boboul-cloud)
