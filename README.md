# percentage_fetcher_for_bulbapedia
"percentage fetcher for bulbapedia" is a TamperMonkey script adds a little something to the tables under "Game Locations" on every Pokémon's page. For every route mentioned in the table, the script fetches the highest encounter rate for the pokémon and given game in question, and displays it next to the link to the route.

As a small bonus, the script also tries to modify the link url for these routes, so it jumps to the correct table (if the given generation is mentioned on the linked page's ToC, it should jump to that by adding "#\<given_generation_name\>" or if not, at least a "#Pokémon")
