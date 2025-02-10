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
  modify_generation_tables(generation_tables)
})();

function modify_generation_tables(generation_tables) {
  var generation_table_index = 0
  generation_tables.forEach((generation_table) => {
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
        makeRouteLinkBetter(route, generation_name, game_names)
      })
      route_set_index++
    })
    generation_table_index++
  })
}

async function makeRouteLinkBetter(route, generation_name, game_names) {
  var should_skip = matchOneOfTheFollowing(route.href, [
    /\/Time$/,
    /\/Evolution$/,
    /\/Route$/,
    /\/.*?_\(Pok\%C3\%A9mon\)$/,
    /\/Pok\%C3\%A9mon_Bank$/,
    /\/Trade$/,
    /\/Days_of_the_week#.*?$/,
  ])
  if (should_skip) return
  var routehref = route.getAttribute("href")
  const linked_page = routehref.replace(/^\/wiki\//, "")
  const generation_name_underscored = generation_name.replace(" ", "_")

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
      ).then((res) => HTMLStringToDocument(res)
      ).then((res) => {
        return {
          document: res,
          relavant_section: res.querySelector(`#${generation_name_underscored}`) !== null ? generation_name_underscored : "Pok\%C3\%A9mon"
        }
      }).then((res) => {
        modifyHref(route, res.relavant_section)
        return TableElementListInSection(res.document, res.relavant_section)
      }).then((res) => ExtractRelevantRowsFromTables(
        res,
        document.URL.match(/^http.*?\/wiki\/(?<pokemon>.*?)_\(Pok\%C3\%A9mon\)(#.*)?/).groups.pokemon
      ))
    console.log({page: linked_page, rows: linked_page_content })
  }
}

function modifyHref(anchor, UrlFragmentToAppend) {
  const routehref = anchor.getAttribute("href")
  const hasHeading = routehref.includes('#')
  if (!hasHeading) {
    anchor.setAttribute("href",`${routehref}#${UrlFragmentToAppend}`)
  }
}

function HTMLStringToDocument(htmlStr) {
  const parser = new DOMParser();
  return parser.parseFromString(htmlStr, "text/html");
}

function TableElementListInSection(parsedDoc, sectionId) {
  const section_header = parsedDoc.querySelector(`#${sectionId}`).parentNode
  const captureAnyTable = (element) => {
    return element.nodeName.toLowerCase() === "table"
  }
  const untilFindingAnotherHeaderOfSameTypeAsSectionHeader = (element) => {
    return element.nodeName === section_header.nodeName && element !== section_header
  }
  return BuildArrayWithTraversal(
    section_header,
    captureAnyTable,
    untilFindingAnotherHeaderOfSameTypeAsSectionHeader
  )
}

function ExtractRelevantRowsFromTables(tableElementList, target_pokemon) {
  const rowWithGivenPokemon = (element) => {
    var is_non_header_row = element.firstElementChild.nodeName.toLowerCase() === "td"
    if (is_non_header_row) {
      const pokemon_span = element.firstElementChild.querySelector("table>tbody>tr>*>a>span")
      if (pokemon_span !== null) {
        const pokemon_in_this_row = pokemon_span.innerText
        const has_pokemon_in_question = pokemon_in_this_row === target_pokemon
        return has_pokemon_in_question
      }
    }
  }

  var rows_with_pokemon_in_question = []
  tableElementList.forEach((table) => {
    var rows_from_this_table = BuildArrayWithTraversal(
      table.querySelector("tbody>tr"),
      rowWithGivenPokemon,
      (iterated_element) => false,
      200
    )
    rows_with_pokemon_in_question = rows_with_pokemon_in_question.concat(rows_from_this_table)
  })
  return rows_with_pokemon_in_question
}

function BuildArrayWithTraversal(startElement, captureFunc, untilFunc = (it_el) => false, tries = 20) {
  var buildArray = []
  var traverse = startElement
  for (let i = 0; i < tries; i++) {
    if (traverse === null) break;
    if (untilFunc(traverse)) break;

    if (captureFunc(traverse)) {
      buildArray.push(traverse)
    }

    traverse = traverse.nextElementSibling
  }
  return buildArray
}

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

