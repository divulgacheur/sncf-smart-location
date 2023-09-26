# SNCF Smart Location

## Présentation

`SNCF Smart Location` est un utilitaire en ligne de commande Bash conçu pour récupérer en temps réel les données de position et de vitesse des trains en France. C'est un outil destiné aux voyageurs qui souhaitent obtenir des informations détaillées sur leur trajet en cours. Cet outil détermine le type de train en fonction du nom du réseau WiFi (INTERCITES, INOUI, LYRIA, OUIFI) et utilise l'API des services de train pour obtenir la latitude, la longitude et la vitesse actuelles du train.

## Fonctionnalités

- Récupère et affiche en temps réel les coordonnées de latitude et de longitude ainsi que la vitesse du train.
- Identifie automatiquement le type de service de train (Intercités de jour, Intercités de nuit, TGV-Inoui, Lyria, OuiGo) en fonction du nom du réseau WiFi (INTERCITES, INOUI, LYRIA, OUIFI).
- Utilise l'API Overpass pour identifier et afficher les voies ferrées et les gares proches en fonction des coordonnées actuelles.
- Propose un lien vers OpenRailwayMap pour une représentation visuelle de la localisation du train.
- Évalue si le train se rapproche ou s'éloigne d'une gare spécifique.

## Pré-Requis

- `jq` pour traiter les réponses JSON.
- `curl` pour exécuter des requêtes HTTP.
- `bc` pour effectuer des opérations mathématiques.
- Un environnement de type Unix pour exécuter le script Bash.

## Utilisation

1. Clonez le dépôt GitHub sur votre machine.
2. Accordez la permission d'exécution au script : `chmod +x sncf_smart_location.sh`
3. Exécutez le script : `./sncf_smart_location.sh`
   Utilisez `-v` ou `--verbose` pour un affichage détaillé et `-q` ou `--quiet` pour désactiver les affichages inutiles.

## Limitations

- On suppose que l'utilisateur est à bord d'un train et connecté au réseau WiFi du train (`_SNCF_WIFI_INOUI`, `_SNCF_WIFI_INTERCITES`, `OUIFI` or `_WIFI_LYRIA`) pour déterminer le type de train.
- La précision des données de position et de vitesse dépend de l'API des services de train.

## Contribution

Les contributions pour améliorer `SNCF Smart Location` sont les bienvenues. Générez une pull request pour commencer le processus de contribution.

## Licence

Le projet est sous licence MIT.

## Avertissement

`SNCF Smart Location` est un outil indépendant et n'est officiellement associé à aucun fournisseur de services de train. La précision et la disponibilité des données dépendent des API respectives utilisées.
