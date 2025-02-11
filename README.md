# percentage_fetcher_for_bulbapedia
"percentage fetcher for bulbapedia" is a TamperMonkey script adds a little something to the tables under "Game Locations" on every Pokémon's page. For every route mentioned in the table, the script fetches the highest encounter rate for the pokémon and given game in question, and displays it next to the link to the route.

As a small bonus, the script also tries to modify the link url for these routes, so it jumps to the correct table (if the given generation is mentioned on the linked page's ToC, it should jump to that by adding "#\<given_generation_name\>" or if not, at least a "#Pokémon")

# How to install

There's two ways to go about this. The easy way if you trust me 😃, and the hard way if you trust noone  🕵️.

## Easy way 😃

Copy the file `percentage_fetcher_for_bulbapedia.js` and add it as a new tamperMonkey script

## Hard way  🕵️

- Clone this repo
- Inspect the typescript file in `src` aka `src/percentage_fetcher_for_bulbapedia.ts` and verify its trustworthiness. I recommend keeping an eye out for any calls to `fetch`, `querySelector` and `querySelectorAll`.
- Inspect the `build.sh` and verify its trustworthines.
- Make sure the typescript compiler (tsc) is installed and install it if not
- If on Windows:
  - Copy the command(s) in build.sh and run them in a Powershell.exe (the commands should be platform-agnostic)
- If on Linux:
  - The script can be run directly. Make sure to make the script executable first awith `chmod +x build.sh`.
Copy the resulting js file and add it as a new tamperMonkey script
