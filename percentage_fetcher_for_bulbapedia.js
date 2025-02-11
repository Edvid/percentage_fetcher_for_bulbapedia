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
  const locations_table_class = "location_table_Obs7o"

  var body = document.querySelector("body")

  var game_locations = document.querySelector("#Game_locations")
  var game_locations_table = game_locations.parentNode.nextElementSibling
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
    /\/Dual-slot_mode(#.*?)?$/,
    /\/Days_of_the_week(#.*?)?$/,
    /\/Headbutt_tree$/
  ])
  if (should_skip) return
  var routehref = route.getAttribute("href")
  const linked_page = routehref.replace(/^\/wiki\//, "")
  const generation_name_underscored = generation_name.replace(" ", "_")

  if (generation_name === "Generation IV" && (game_names.includes("HeartGold") || game_names.includes("SoulSilver") || game_names.includes("Platinum"))) {
    var percentage_winner = await fetch(
      `https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=${linked_page}&format=json`
    ).then((res) => {
        if (res.status !== 200) {
          throw new Error(`There was an error with status code ${res.status}`)
        }
        return res.json()
      }).then(
        (res) => res.parse.text["*"]
      ).then((res) => HTMLStringToDocument(res)
      ).then((doc) => {
        return {
          document: doc,
          relavant_section: doc.querySelector(`#${generation_name_underscored}`) !== null ? generation_name_underscored : "Pok\%C3\%A9mon"
        }
      }).then((res) => {
        modifyHref(route, res.relavant_section)
        return TableElementListInSection(res.document, res.relavant_section)
      }).then((tablesInSection) => ExtractRelevantRowsFromTables(
        tablesInSection,
        document.URL.match(/^http.*?\/wiki\/(?<pokemon>.*?)_\(Pok\%C3\%A9mon\)(#.*)?/).groups.pokemon,
        game_names
      )).then((rows) => rows.map((row) => getHighestProcentageFromTableRow(row)
      )).then((percentages) => percentages.sort().reverse()[0])
    console.log({page: linked_page, percentages: percentage_winner })
    appendNumToLink(route, percentage_winner)
  }
}

function appendNumToLink(anchor, num) {
  // "rgb(225, 140, 0)"
  const percentage_display_color = "rgb(128, 35, 160)"
  var sup = document.createElement("sup")
  var span = document.createElement("span")
  span.innerText = num + "%"
  span.style.fontWeight = "Bold"
  span.style.fontSize = "10px"
  span.style.color = "rgb(255, 255, 255)"
  span.style.background = percentage_display_color
  span.style.marginLeft = "3px"
  span.style.padding = "1px 2px 1px 2px"
  span.style.borderRadius = "2px"
  sup.appendChild(span)
  anchor.after(sup)
}

function getHighestProcentageFromTableRow(tableRow) {
  const numCaptureRegex = /(?<num>(?:\d|\.)+)%\n?/
  const isDataRowWithPercentage = (el) => {
    var is_non_header_row = el.nodeName.toLowerCase() === "td"
    if (is_non_header_row) {
      var is_percentage_container = el.innerText.match(numCaptureRegex)
      if (is_percentage_container) {
        return true
      }
    }
    return false
  }
  return BuildArrayWithTraversal(
    tableRow.firstElementChild,
    isDataRowWithPercentage
  ).map(
      (td) => td.innerText.match(numCaptureRegex).groups.num
  ).sort().reverse()[0]
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

function ExtractRelevantRowsFromTables(tableElementList, target_pokemon, target_games) {
  const isRowWithGivenPokemon = (element) => {
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

  const isRowWithAtLeastOneOfGivenGames = (element) => {
    const captureTh = (el) => el.nodeName.toLowerCase() === "th"

    const colorIsBlank = (el) => {
      const { r, g, b } = el.style.background.match(/rgb\( ?(?<r>.*?), ?(?<g>.*?), ?(?<b>.*?) ?\)/).groups
      if (
        r === "0" &&
        g === "0" &&
        b === "0"
      ) return true
      if (
        r === "255" &&
        g === "255" &&
        b === "255"
      ) return true
      return false
    }

    const matchStrWithAnyInArr = (str, arr) => {
      return arr.filter((el) => el === str).length > 0
    }

    var thElements = BuildArrayWithTraversal(
      element.firstElementChild,
      captureTh,
      (_iterated_element) => false
    )
    const target_games_abbr = target_games.map((game_name) => findAbbreviation(game_name))
    const isHighlightingAtLeastOneOfGameNames = () => {
      return thElements.filter((th) => {
        if (colorIsBlank(th)) return false
        if (matchStrWithAnyInArr(th.firstElementChild.innerText, target_games_abbr)) return true
        return false
      }).length > 0
    }
    return isHighlightingAtLeastOneOfGameNames()
  }

  const isRelevantGamesRow = (el) => isRowWithGivenPokemon(el) && isRowWithAtLeastOneOfGivenGames(el)

  var rows_with_pokemon_in_question = []
  tableElementList.forEach((table) => {
    var rows_from_this_table = BuildArrayWithTraversal(
      table.querySelector("tbody>tr"),
      isRelevantGamesRow,
      (_iterated_element) => false,
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

function findAbbreviation(str) {
  switch (str) {
    case "Platinum":
      return "Pt"
    default:
      return str.replace(/[a-z ]/g, "")
  }
}

