# ⚽ Temps De Jeu

Application iOS complète pour gérer le temps de jeu, les cartons, l'encadrement, les entraînements et les statistiques de vos équipes de football. Idéale pour les entraîneurs de clubs amateurs qui veulent assurer une répartition équitable du temps de jeu.

## Fonctionnalités

### ⏱️ Gestion du Match
- Chronomètre de match avec **11 types d'arrêts de jeu** (touche, corner, coup franc, penalty, blessure, VAR, hors-jeu…)
- Calcul automatique du **temps additionnel** (blessures + VAR + hors-jeu + 30s par remplacement)
- Suivi en temps réel du temps de jeu de chaque joueur
- Gestion des remplacements par simple glisser-déposer
- Support des **prolongations** (2 × 15 minutes)
- Sélection **domicile / extérieur** avec configuration des noms d'équipes
- Timeline complète des événements (buts, cartons, remplacements, fautes)
- **Brouillon de match** automatique par catégorie

### 🟨 Gestion des Cartons
- Suivi des cartons **jaunes, 2ème jaunes, rouges** et **blancs**
- **Carton blanc** : expulsion temporaire de 10 minutes avec compte à rebours en direct
- Alerte automatique quand le joueur peut revenir sur le terrain
- Tableau de bord dédié avec classement par joueur et filtrage par type
- Purge des cartons purgés (suspension purgée)

### 👥 Gestion d'Équipe
- Création et gestion de l'effectif avec positions, photos et disponibilités
- **4 statuts de disponibilité** : disponible, blessé, absent, suspendu
- Attribution des numéros et positions (Gardien, Défenseur, Milieu, Attaquant)
- Photos avec compression automatique

### 🏠 Multi-catégories
- Gestion de plusieurs équipes (U13, U15, Seniors…) avec base de joueurs partagée
- Chaque catégorie a ses propres matchs, entraînements et saison
- Barre de sélection rapide en haut de l'écran
- **Code catégorie** unique à 6 caractères pour la synchronisation entre appareils
- Joueurs inter-catégories avec badge de couleur de la catégorie d'origine

### 👔 Gestion de l'Encadrement
- Ajout de staff : coachs, adjoints, arbitres, délégués, préparateurs physiques, etc.
- **8 rôles prédéfinis** + rôles personnalisables
- Coordonnées (téléphone, email) avec **appel direct** depuis l'app
- Photos du staff avec compression automatique
- Assignation multi-catégorie

### 🏋️ Entraînements & Présences
- Pointage des présences aux entraînements
- Invitation de joueurs d'autres catégories (joueurs invités)
- Statistiques de présence par joueur et par période
- Export des feuilles de présence en PDF

### 📊 Statistiques en Direct
- Jauge de **temps effectif** (% de jeu effectif vs. total)
- Répartition des arrêts par type et par équipe bénéficiaire
- Suivi des **fautes** par joueur avec détail par période
- Tableau des **buteurs** avec minutes de but
- Statistiques par période (MT1, MT2, PR1, PR2)

### 🔄 Partage de Composition (Cascade)
Système unique pour les clubs avec plusieurs équipes (A, B, C, D…) :
- L'équipe A sélectionne ses joueurs et partage les disponibles à l'équipe B
- L'équipe B fait de même pour l'équipe C, etc.
- Évite les conflits de sélection entre équipes

**Modes de partage :**
- 📄 Fichier `.tdj` (composition) / `.tdjm` (matchs) — S'ouvre directement dans l'app
- 🔗 Lien iMessage — Cliquable, importe automatiquement avec routage par code catégorie
- 📑 PDF — Pour impression ou archivage

### 📦 Import / Export
- Export/Import des effectifs, matchs et entraînements en PDF ou JSON
- Fichiers personnalisés `.tdj` (compositions) et `.tdjm` (matchs)
- Import intelligent avec **dédoublonnage automatique** et fusion des données
- **Routage automatique** vers la bonne catégorie via le code catégorie
- Deep links `tempsdejeu://` pour l'import depuis iMessage

### 📅 Gestion des Saisons
- Organisation des données par saison
- Archivage en fin de saison
- Réinitialisation pour repartir de zéro

### 🧊 Placement 3D & Tactiques animées
- Vue **Placement en 3D** (bascule 2D / 3D) : terrain en relief, joueurs déplaçables au doigt ou à la souris
- 4 caméras : **Coach**, **Tribune**, **Dessus**, **Immersion** (rotation et zoom libres)
- **Séquences pas à pas** : capturez plusieurs étapes du placement puis lancez la démonstration animée
- **Bibliothèque de 12 exercices** (rondos, relance, troisième homme, chevauchement, pressing, coulissement, contre-attaque, contre-pressing, corner…) avec objectif, consignes et déroulé
- Flèches calculées automatiquement : course, passe, conduite, tir ; joueurs clés en surbrillance
- Lecture automatique, vitesse réglable, option « Afficher mes joueurs » (noms des titulaires)
- Fichiers **`.tdjt`** (JSON lisible) : import / export / partage de tactiques

### 🧰 Atelier d'exercices (plein écran)
- Ouvert depuis **Présences › Atelier** : iPhone, iPad et Mac en **plein écran**, le terrain pivote à l'horizontale quand il y gagne de la place
- **Tiroir de matériel** : joueurs, gardiens, ballon, plots, coupelles, piquets, mannequins, mini-buts, buts, zones (en mètres), lignes de plots, cerceaux, échelles, haies, ballons — on touche un outil puis le terrain (l'outil reste actif)
- **8 couleurs** de chasubles et de matériel ; **raccourcis** (carrés, rondos, jeux réduits avec mini-buts, slalom…)
- **Vignettes** façon Keynote : « + Étape » copie la précédente, on déplace, les flèches (course, passe, conduite, centre, tir) se tracent seules ; aperçu 2D et **mode cinéma** 3D plein écran avec sous-titres
- **Évolutions** d'un exercice (même terrain, consigne différente), **annuler / rétablir**
- **Fiche** : objectif, consignes, **matériel à prévoir calculé**, PDF à imprimer
- **Séances** : exercices minutés, matériel total (en série ou ateliers simultanés), **équipes composées avec les présents** du jour, PDF de séance
- Code : `Views/Atelier/`, `Models/AtelierModels.swift`, `Models/TrainingPlanModels.swift` ; séances dans `Application Support/Tactiques/mes-seances.json` et dans la sauvegarde complète ; testé par `TempsDeJeuUITests/AtelierTests`

### 💻 Version Mac
- Application **Mac Catalyst** (Apple Silicon + Intel), disposition deux colonnes pour la 3D
- `./tools/creer-dmg-mac.sh` génère le DMG dans `../Version Mac/` (signature locale)
- Version DMG **sans limite** : Premium débloqué d'office (drapeau `DMG_SANS_LIMITE`, ajouté uniquement par ce script)

### 📖 Guide d'Utilisation Intégré
- Mode d'emploi complet avec 16 sections illustrées
- Accessible depuis les réglages de l'app
- Couvre toutes les fonctionnalités : effectif, match, cascade, statistiques, catégories, présences…

### 💎 Premium
- Version gratuite : **5 matchs**
- Version Premium : **achat unique à 4.99€** (non-abonnement), matchs illimités
- Restauration des achats sur tous les appareils

## Installation

L'application est disponible sur l'[App Store](https://apps.apple.com/app/temps-de-jeu/id6742602498).

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
├── Models/          # Modèles de données (Player, Match, Staff, Training, etc.)
├── ViewModels/      # Logique métier (MatchViewModel)
├── Views/           # Interfaces SwiftUI (Match, Roster, Cartons, Staff, Stats…)
├── Services/        # Services (DataManager, ProfileManager, StoreManager, TacticStore, etc.)
├── Resources/       # TactiquesEntrainement.json (bibliothèque d'exercices)
└── Helpers/         # Utilitaires (TimeFormatters, ColorExtensions)
tools/
├── generer_tactiques.py   # Génère et valide la bibliothèque d'exercices
└── creer-dmg-mac.sh       # Construit la version Mac et le DMG
```

## Site Web & Support

- 🌐 [Site web](https://boboul-cloud.github.io/Temps-De-Jeu/)
- 📧 [bob.oulhen@gmail.com](mailto:bob.oulhen@gmail.com)
- 🐛 [Issues GitHub](https://github.com/boboul-cloud/Temps-De-Jeu/issues)

## Licence

MIT License — Voir [LICENSE](LICENSE)

## Auteur

Robert Oulhen — [@boboul-cloud](https://github.com/boboul-cloud)
