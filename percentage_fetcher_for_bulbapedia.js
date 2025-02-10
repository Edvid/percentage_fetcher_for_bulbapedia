// ==UserScript==
// @name         Percentage fetcher for bulbapedia
// @namespace    http://tampermonkey.net/
// @version      2025-02-09
// @description  try to take over the world!
// @author       You
// @match        https://bulbapedia.bulbagarden.net/wiki/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bulbagarden.net
// @grant        none
// ==/UserScript==



(async function() {
  'use strict';
  var locations_table_class = "location_table_Obs7o"

  var body = document.querySelector("body")
  body.style.background = "cyan"

  var game_locations = document.querySelector("#Game_locations")
  var game_locations_table = game_locations.parentNode.nextElementSibling
  game_locations_table.style.borderWidth = "10px"
  game_locations_table.classList.add(locations_table_class)
  var generation_tables = document.querySelectorAll(`.${locations_table_class}>tbody>tr>td>table`)
  var generation_table_index = 0
  generation_tables.forEach(async (generation_table) => {
    var this_generation_table_class = "generation_table_31Lhg_" + generation_table_index
    generation_table.classList.add(this_generation_table_class)

    var generation_name = document.querySelector(`.${this_generation_table_class}>tbody>tr>th>*`).innerText

    var inner_generation_table_class = "inner_generation_table_W6Wd8_" + generation_table_index
    var inner_generation_table = document.querySelector(`.${this_generation_table_class}>tbody>tr>td>table`)
    inner_generation_table.classList.add(inner_generation_table_class)

    var route_set_names = document.querySelectorAll(`.${inner_generation_table_class}>tbody>tr`)
    var route_sets = document.querySelectorAll(`.${inner_generation_table_class}>tbody>tr>td>table>tbody>tr>td`)

    var route_set_index = 0
    route_sets.forEach((route_set) => {
      var game_names = Array.from(route_set_names[route_set_index].querySelectorAll("th>a>span")).map((el) => el.innerText)
      var routes = route_set.querySelectorAll("a")

      routes.forEach(async (route) => {
        var should_skip = matchOneOfTheFollowing(route.href, [
          /\/Time$/,
          /\/Evolution$/,
          /\/Route$/,
          /\/.*?_\(Pok\%C3\%A9mon\)$/,
          /\/Pok\%C3\%A9mon_Bank$/,
          /\/Trade$/,
          /\/Days_of_the_week#.*?$/,
        ])
        if (!should_skip) {
          var routehref = route.getAttribute("href")
          const linked_page = routehref.replace(/^\/wiki\//, "")
          const generation_name_underscored = generation_name.replace(" ", "_")
          var hasHeading = routehref.includes('#')
          if (!hasHeading) {
            route.setAttribute("href",`${routehref}#${generation_name_underscored}`)
          }
          if (generation_name === "Generation IV" && game_names.includes("Platinum")) {
            var linked_page_content = await fetch(
              `https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=${linked_page}&format=json`
            ).then((res) => {
              if (res.status !== 200) {
                throw new Error(`There was an error with status code ${res.status}`)
              }
              return res.json()
            }).then(
              (res) => res.parse.text["*"]
            ).then((res) => {
              const parser = new DOMParser();
              return parser.parseFromString(res, "text/html");
            }).then((res) => {
              const section_header = res.querySelector(`#${generation_name_underscored}`).parentNode
              let tables_in_section = []
              let traverse = section_header
              const tries = 20
              for (let i = 0; i < tries; i++) {
                if (traverse === null) break;
                if (traverse.nodeName === section_header.nodeName && traverse !== section_header) break;

                if (traverse.nodeName.toLowerCase() === "table") {
                  tables_in_section.push(traverse)
                }
                traverse = traverse.nextElementSibling
              }
              return tables_in_section
            }).then((res) => {
              const pokemon_name = document.URL.match(/^http.*?\/wiki\/(?<pokemon>.*?)_\(Pok\%C3\%A9mon\)(#.*)?/).groups.pokemon

              var rows_with_pokemon_in_question = []
              res.forEach((t) => {
                var traverse = t.querySelector("tbody>tr")
                const tries = 200
                for (let i = 0; i < tries; i++) {
                  if (traverse === null) break;
                  var is_non_header_row = traverse.firstElementChild.nodeName.toLowerCase() === "td"
                  if (is_non_header_row) {
                    const pokemon_span = traverse.firstElementChild.querySelector("table>tbody>tr>*>a>span")
                    if (pokemon_span === null) continue;
                    const pokemon_in_this_row = pokemon_span.innerText
                    const has_pokemon_in_question = pokemon_in_this_row === pokemon_name
                    if (has_pokemon_in_question) rows_with_pokemon_in_question.push(traverse)
                  }
                  traverse = traverse.nextElementSibling
                }
              })
              return rows_with_pokemon_in_question
            })
            console.log({page: linked_page, rows: linked_page_content })
          }

          // console.log(`${route.innerText}:`)
          // console.log(route.href)
        }
      })
      route_set_index++
    })
    //https://bulbapedia.bulbagarden.net/wiki/Sinnoh_Route_205#Generation_IV
    generation_table_index++
  })
})();

function matchOneOfTheFollowing(str, possibleMatch) {
  var returnValue = false
  possibleMatch.forEach((m) => {
    if (str.match(m)) {
      returnValue = true
      return;
    }
  })

  return returnValue
}


