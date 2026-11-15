# Achats intégrés

Un seul achat, **déjà créé et validé chez Apple** avec les versions précédentes : rien à créer
pour la 1.7. L'identifiant ci-dessous est exactement celui du code (`StoreManager.premiumProductID`)
et du fichier `Configuration.storekit`.

## Produit 1 — Premium

| Champ App Store Connect | À saisir |
|---|---|
| Type | **Non consommable** |
| Nom de référence (interne) | `Premium Upgrade` |
| Identifiant de produit | `com.tempsDeJeu.premium` |
| Prix | **4,99 €** (France) |
| Partage familial | **Désactivé** (comme dans `Configuration.storekit`) |

**Localisation française**

| Champ | Valeur |
|---|---|
| Nom affiché | `Temps De Jeu Premium` (20/30) |
| Description | `Débloquez un accès illimité à tous les matchs` (45/45) |

Pas de localisation anglaise : l'app n'existe qu'en français.

Capture de contrôle : l'achat est déjà validé, Apple n'en redemande pas pour une mise à jour
qui ne le modifie pas. Si besoin, la prendre depuis Xcode (⌘R, fichier `.storekit` attaché) sur
l'écran Réglages et Exports › Version gratuite › Upgrade, et l'enregistrer en
`captures/achats/premium.png`.

## Informations pour l'examen

**Notes d'examen**

```
Achat unique non consommable « Temps De Jeu Premium » : il lève la limite de
5 matchs gratuits (matchs illimités). On le trouve dans l'onglet Réglages et
Exports > « Version gratuite » > Upgrade, et dans l'onglet Match : le bandeau
« Version gratuite » propose « Passer Premium » (au-delà de 5 matchs, le
bouton « Démarrer le match » est grisé).
« Restaurer mes achats » est sur le même écran. Toutes les autres fonctions,
dont le placement 3D et la bibliothèque d'exercices, restent accessibles sans
achat.
```
