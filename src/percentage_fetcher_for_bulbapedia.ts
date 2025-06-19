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



(function() {
  'use strict';
  // Settings START
  const locations_table_class = "location_table_Obs7o"
  const percentage_display_color = "rgb(128, 35, 160)"
  const wait_period = 3000 // be very careful when lowering this number. If you are impatient, you can. But note that you will be requesting from API much faster, and you increase your risk of your IP being banned from the wiki
  // Settings END
  const pokemon_regex = /^http.*?\/wiki\/(?<pokemon>.*?)_\(Pok\%C3\%A9mon\)(#.*)?/

  const IMPOSSIBLE = " This error should never happen."
  const STANDARD_ERROR_END = " Report a bug if you see this."

  const NOT_EMPTY_BUT_NO_FIRST = "Array was found to not be empty, yet no first element was found." + IMPOSSIBLE + STANDARD_ERROR_END
  const NO_GAME_LOCATION_TEXT = "Attempted to run percentage fetcher script on pokemon page, but no \"#Game_location\" was found." + STANDARD_ERROR_END
  const NO_GENERATION_NAME_TEXT = "Failed to find the given generation's name for this table." + STANDARD_ERROR_END
  const NO_INNER_GENERATION_TABLE_TEXT = "Failed to find the inner most generation table Element." + STANDARD_ERROR_END
  const NO_HREF_IN_ANCHOR = "A link to a route didn't contain a url to link to." + STANDARD_ERROR_END
  const NO_HREF_IN_ANCHOR_DESPITE_FOUND_EARLIER = "A link which was found to have a url it linked to earlier, now doesn't have one all of a sudden." + IMPOSSIBLE + STANDARD_ERROR_END
  const NO_TEXT_FOUND_IN_TABLE_CELL_DESPITE_CAPTURING_ONLY_TEXT_TABLE_CELL = "Text was not found in a given Table Cell Element (td/th) despite this code only running on Table Cells captured that had text in them." + IMPOSSIBLE + STANDARD_ERROR_END
  const GIVEN_SECTION_NOT_FOUND = "Failed to find the correct section to scan tables from." + STANDARD_ERROR_END

  interface RouteLinkTaskInfo {
    route: HTMLAnchorElement
    generation_name: string
    game_names: string[]
  }

  let queuedRouteLinkTasks: RouteLinkTaskInfo[] = []

  const is_pokemon_page = matchCurrentUrl(pokemon_regex)
  if (is_pokemon_page === null) {
    return
  }
  setInterval(handleQueuedRouteLinkTasks, wait_period)
  const game_locations = document.querySelector("#Game_locations")
  if (!game_locations) {
    console.error(NO_GAME_LOCATION_TEXT)
    return
  }
  const game_locations_table = game_locations.parentElement!.nextElementSibling!
  game_locations_table.classList.add(locations_table_class)
  const generation_tables = document.querySelectorAll(`.${locations_table_class}>tbody>tr>td>table`)
  modify_generation_tables(generation_tables)

  function handleQueuedRouteLinkTasks () {
    if (queuedRouteLinkTasks.length <= 0) { return }

    const task = queuedRouteLinkTasks.shift()
    if (!task) {
      console.error(NOT_EMPTY_BUT_NO_FIRST)
      return
    }
    FetchPercentageFromAPI(task)
  }

  function modify_generation_tables(generation_tables: NodeListOf<Element>) {
    let generation_table_index = 0
    generation_tables.forEach((generation_table) => {
      const this_generation_table_class = "generation_table_31Lhg_" + generation_table_index
      generation_table.classList.add(this_generation_table_class)

      const generation_name_element = document.querySelector(`.${this_generation_table_class}>tbody>tr>th>*`)
      if (!generation_name_element) {
        console.error(NO_GENERATION_NAME_TEXT)
        return
      }
      const generation_name = generation_name_element.textContent

      const inner_generation_table_class = "inner_generation_table_W6Wd8_" + generation_table_index
      const inner_generation_table = document.querySelector(`.${this_generation_table_class}>tbody>tr>td>table`)
      if (!inner_generation_table) {
        console.error(NO_INNER_GENERATION_TABLE_TEXT)
        return
      }
      inner_generation_table.classList.add(inner_generation_table_class)

      const route_set_game_names = document.querySelectorAll(`.${inner_generation_table_class}>tbody>tr`)
      const route_sets = document.querySelectorAll(`.${inner_generation_table_class}>tbody>tr>td>table>tbody>tr>td`)

      let route_set_index = 0
      route_sets.forEach((route_set) => {
        const game_names = Array.from(route_set_game_names[route_set_index].querySelectorAll("th>a>span")).map((el) => el.textContent).filter((txt) => txt !== null).map((txt) => txt.trim())
        const routes = route_set.querySelectorAll("a")

        routes.forEach((route) => {
          if (generation_name === null) {
            console.error(NO_GENERATION_NAME_TEXT)
            return
          }
          const shouldBetterLink = checkIfShouldBetterLink({route, generation_name, game_names})
          if (shouldBetterLink) {
            makeRouteLinkBetter({route, generation_name, game_names})
          }
        })
        route_set_index++
      })
      generation_table_index++
    })
  }

  function getPokemonNameFromCurrentUrl() {
    return matchCurrentUrl(pokemon_regex)!.groups!.pokemon
  }

  function matchCurrentUrl(regex: RegExp) {
    return document.URL.match(regex)
  }

  function makeRouteLinkBetter(info: RouteLinkTaskInfo) {
    const routehref = info.route.getAttribute("href")
    if (routehref === null) {
      console.error(NO_HREF_IN_ANCHOR_DESPITE_FOUND_EARLIER)
      return
    }
    const linked_page = routehref.replace(/^\/wiki\//, "")

    const percentageAccordingToLocalStore = searchLocalStore(
      getPokemonNameFromCurrentUrl(),
      linked_page,
      info.game_names)
    if (percentageAccordingToLocalStore !== null && !isNaN(percentageAccordingToLocalStore)) {
      appendNumToLink(info.route, percentageAccordingToLocalStore)
    } else {
      queueRouteLink(info)
    }
  }

  function searchLocalStore(pokemon_name: string, route_name: string, game_names: string[]): number | null {
    const id = getLocalStoreKVIDFromIdenfifyingInfo(pokemon_name, route_name, game_names)
    const value = localStorage.getItem(id)
    if (value !== null) {
      return Number(value)
    } else {
      return null
    }
  }

  function setLocalStoreKV(pokemon_name: string, route_name: string, game_names: string[], value: number) {
    const id = getLocalStoreKVIDFromIdenfifyingInfo(pokemon_name, route_name, game_names)
    localStorage.setItem(id, value.toString())
  }

  function getLocalStoreKVIDFromIdenfifyingInfo(pokemon_name: string, route_name: string, game_names: string[]){
    return `${game_names.sort().map((name) => findAbbreviation(name)).join(",")}@${route_name}:${pokemon_name}`
  }

  function queueRouteLink(info: RouteLinkTaskInfo) {
    queuedRouteLinkTasks.push(info)
  }

  function checkIfShouldBetterLink(routeInfo: RouteLinkTaskInfo) {
    // Not a link
    const routehref = routeInfo.route.getAttribute("href")
    if (routehref === null) {
      console.error(NO_HREF_IN_ANCHOR)
      return false
    }
    // Route link links to something blacklisted
    const is_link_blacklisted = matchOneOfTheFollowing(routeInfo.route.href, [
      pokemon_regex,
      /\/Pok\%C3\%A9mon_breeding$/,
      /\/Time$/,
      /\/Evolution$/,
      /\/Route$/,
      /\/.*?_Rod$/,
      /\/Pok\%C3\%A9mon_Bank$/,
      /\/Pok\%C3\%A9mon_Dollar$/,
      /\/.*?_(Pok\%C3\%A9walker)$/,
      /\/Pok\%C3\%A9walker$/,
      /\/Pok\%C3\%A9mon_Dream_World$/,
      /\/Pok\%C3\%A9_Radar$/,
      /\/Pok\%C3\%A9_Transfer$/,
      /\/Mirage_Caves$/,
      /\/Mirage_Mountains$/,
      /\/Mirage_Forests$/,
      /\/Mirage_Islands$/,
      /\/List_of_in-game_event_Pok\%C3\%A9mon_in_Generation_(I|V|X){1,5}(#.*?)$/,
      /\/Red_Gyarados$/,
      /\/.*?_salesman$/,
      /\/Fishing$/,
      /\/Mass_outbreak$/,
      /\/Shadow_Pok\%C3\%A9mon$/,
      /\/Surf_\(move\)$/,
      /\/Trade$/,
      /\/Hidden_Grotto$/,
      /\/Max_Raid_Battle$/,
      /\/Wild_Area_News$/,
      /\/Wanderer$/,
      /\/White_Forest$/,
      /\/Dual-slot_mode(#.*?)?$/,
      /\/Days_of_the_week(#.*?)?$/,
      /\/Headbutt_tree$/
    ])
    if (is_link_blacklisted) {
      return false
    }
    let is_game_blacklisted = false
    routeInfo.game_names.forEach((game_name) => {
      if (matchOneOfTheFollowing(game_name, [
        /\/Pok\%C3\%A9walker$/,
        /Legends: Arceus/,
        /Dream World/,
        /XD/,
        /Colosseum/,
      ])) {
        is_game_blacklisted = true
      }
    })
    if (is_game_blacklisted) {
      return false
    }
    return true
  }

  async function FetchPercentageFromAPI(info: RouteLinkTaskInfo) {
    const { route, generation_name, game_names } = info
    const routehref = route.getAttribute("href")
    if (routehref === null) {
      console.error(NO_HREF_IN_ANCHOR_DESPITE_FOUND_EARLIER)
      return
    }
    const linked_page = routehref.replace(/^\/wiki\//, "")

    const percentage_winner = await fetch(
      `https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=${linked_page}&format=json`
    ).then((res) => {
        if (res.status !== 200) {
          throw new Error(`There was an error with status code ${res.status}`)
        }
        console.log(res)
        return res.json()
      }).then(
        (res) => res.parse.text["*"]
      ).then((res) => HTMLStringToDocument(res)
      ).then((doc) => {
        const section_name = getRelevantSectionName(doc, generation_name)
        return {
          document: doc,
          relavant_section: section_name
        }
      }).then((res) => {
        modifyHref(route, res.relavant_section)
        return TableElementListInSection(res.document, res.relavant_section)
      }).then((tablesInSection) => ExtractRelevantRowsFromTables(
        tablesInSection,
        getPokemonNameFromCurrentUrl(),
        game_names
      )).then((rows) => rows.map((row) => getHighestProcentageFromTableRow(row)
      )).then((percentages) => percentages.sort((a, b) => +b - +a /* descending */)[0])
    appendNumToLink(route, Number(percentage_winner))
    setLocalStoreKV(getPokemonNameFromCurrentUrl(), linked_page, info.game_names, Number(percentage_winner))
  }

  function getRelevantSectionName(doc: Document, generation_name: string) {
    const generation_name_underscored = generation_name.replace(" ", "_")

    const captureSiblingWithSimilarNameToGeneration = (it_el: Element) => {
      const span = it_el.querySelector("span")
      if (span === null) {
        return false
      } else{
        return span.id.match(new RegExp(`${generation_name_underscored}(_\d)?`)) !== null
      }
    }
    const pokemonIDedElement = doc.querySelector("#Pokémon")
    if (pokemonIDedElement == null) {
      console.error(`Something went wrong finding the Pokémon id'ed element. Page is: ${doc.querySelector("#firstHeading span")?.textContent}`)
      return "Pokémon"
    }
    const pokemonIDedParent = pokemonIDedElement?.parentElement
    if (pokemonIDedParent == null) {
      console.error(`This should never happen. Page is: ${doc.querySelector("#firstHeading span")?.textContent}`)
      return "Pokémon"
    }

    const potentialCorrectSections = BuildArrayWithTraversal(
      doc.querySelector("#Pokémon")!.parentElement!,
      captureSiblingWithSimilarNameToGeneration
    ).find((el) => el && el !== null)

    return potentialCorrectSections ? potentialCorrectSections.querySelector("span")!.id : "Pokémon"
  }

  function appendNumToLink(anchor: HTMLAnchorElement, num: number) {
    const sup = document.createElement("sup")
    const span = document.createElement("span")
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

  function getHighestProcentageFromTableRow(tableRow: Element) {
    const numCaptureRegex = /(?<num>(?:\d|\.)+)%\n?/
    const isDataRowWithPercentage = (el: Element) => {
      const is_non_header_row = el.nodeName.toLowerCase() === "td"
      if (is_non_header_row) {
        const text = el.textContent
        if (text === null) {
          return false
        }
        const is_percentage_container = text.match(numCaptureRegex)
        if (is_percentage_container !== null) {
          return true
        }
      }
      return false
    }
    return BuildArrayWithTraversal(
      tableRow.firstElementChild!,
      isDataRowWithPercentage
    ).map(
        (td) => {
          let text = td.textContent
          if (text === null) {
            console.error(NO_TEXT_FOUND_IN_TABLE_CELL_DESPITE_CAPTURING_ONLY_TEXT_TABLE_CELL)
            return "FAILED_TD"
          }
          return text.match(numCaptureRegex)!.groups!.num
        }
    ).sort((a, b) => +b - +a /* descending */)[0]
  }

  function modifyHref(anchor: HTMLAnchorElement, UrlFragmentToAppend: string) {
    const routehref = anchor.getAttribute("href")
    if (routehref === null) {
      console.error(NO_HREF_IN_ANCHOR)
      return
    }
    const hasHeading = routehref.includes('#')
    if (!hasHeading) {
      anchor.setAttribute("href",`${routehref}#${UrlFragmentToAppend}`)
    }
  }

  function HTMLStringToDocument(htmlStr: string) {
    const parser = new DOMParser();
    return parser.parseFromString(htmlStr, "text/html");
  }

  function TableElementListInSection(parsedDoc: Document, sectionId: string) {
    const section_id_el = parsedDoc.querySelector(`#${sectionId}`)
    if (section_id_el === null) {
      console.error(GIVEN_SECTION_NOT_FOUND)
      return []
    }
    const section_header = section_id_el.parentElement!
    const captureAnyTable = (element: Element) => {
      return element.nodeName.toLowerCase() === "table"
    }
    const untilFindingAnotherHeaderOfSameTypeAsSectionHeader = (element: Element) => {
      return element.nodeName === section_header.nodeName && element !== section_header
    }
    return BuildArrayWithTraversal(
      section_header,
      captureAnyTable,
      untilFindingAnotherHeaderOfSameTypeAsSectionHeader
    )
  }

  function ExtractRelevantRowsFromTables(tableElementList: Element[], target_pokemon: string, target_games: string[]) {
    const isRowWithGivenPokemon = (element: Element) => {
      const is_non_header_row = element.firstElementChild!.nodeName.toLowerCase() === "td"
      if (is_non_header_row) {
        const pokemon_span_candidates = element.firstElementChild!.querySelectorAll("* a>span")
        const pokemon_span = Array.from(pokemon_span_candidates).find((el) =>
          el.textContent && el.textContent.length > 0
        )
        if (!pokemon_span || typeof pokemon_span === 'undefined') {
          return false
        }
        const pokemon_in_this_row = pokemon_span.textContent
        const has_pokemon_in_question = pokemon_in_this_row === target_pokemon
        return has_pokemon_in_question
      }
      return false
    }

    const isRowWithAtLeastOneOfGivenGames = (element: Element) => {
      const captureCells = (el: Element) => el.nodeName.toLowerCase() === "th" || el.nodeName.toLowerCase() === "td"

      const colorIsBlank = (el: Element) => {
        const groups = (el as HTMLElement).style.background.match(/rgb\( ?(?<r>.*?), ?(?<g>.*?), ?(?<b>.*?) ?\)/)!.groups
        if (!groups) {
          return true
        }
        const r = groups.r
        const g = groups.g
        const b = groups.b
        if (
          r === "0" &&
          g === "0" &&
          b === "0"
        ) {
          return true
        }
        if (
          r === "255" &&
          g === "255" &&
          b === "255"
        ) {
          return true
        }
        return false
      }

      const matchStrWithAnyInArr = (str: string, arr: string[]) => {
        return arr.filter((el) => el === str).length > 0
      }

      const cellElements = BuildArrayWithTraversal(
        element.firstElementChild!,
        captureCells,
        (_iterated_element) => false
      )
      const target_games_abbr = target_games.map((game_name) => findAbbreviation(game_name))
      const isHighlightingAtLeastOneOfGameNames = () => {
        return cellElements.filter((cellElement) => {
          if (colorIsBlank(cellElement)) {
            return false
          }
          let cellChild = cellElement.firstElementChild;
          if (cellChild === null) {
            // ASSUMPTION: The cellElement for games never just
            // contain textContent directly. It is always within
            // some element (possibly an anchor) as it needs
            // to link to the game in question
            return false
          }
          let text = cellChild.textContent
          if (text === null) {
            return false
          }
          if (matchStrWithAnyInArr(text, target_games_abbr)) {
            return true
          }
          return false
        }).length > 0
      }
      return isHighlightingAtLeastOneOfGameNames()
    }

    const isRelevantGamesRow = (el: Element) => isRowWithGivenPokemon(el) && isRowWithAtLeastOneOfGivenGames(el)

    let rows_with_pokemon_in_question: Element[] = []
    tableElementList.forEach((table) => {
      const rows_from_this_table = BuildArrayWithTraversal(
        table.querySelector("tbody>tr")!,
        isRelevantGamesRow,
        (_iterated_element) => false,
        200
      )
      rows_with_pokemon_in_question = rows_with_pokemon_in_question.concat(rows_from_this_table)
    })
    return rows_with_pokemon_in_question
  }

  function BuildArrayWithTraversal(startElement: Element, captureFunc: (it_el: Element) => boolean, untilFunc: (it_el: Element) => boolean = (_it_el: Element) => false, tries: number = 20) {
    const buildArray: Element[] = []
    let traverse: Element | null = startElement
    for (let i = 0; i < tries; i++) {
      if (traverse === null) {
        break
      }
      if (untilFunc(traverse)) {
        break
      }

      if (captureFunc(traverse)) {
        buildArray.push(traverse)
      }

      traverse = traverse.nextElementSibling
    }
    return buildArray
  }

  function matchOneOfTheFollowing(str: string, possibleMatch: (RegExp | string)[]) {
    return (
      possibleMatch
      .map(
        (m) => str.match(m) !== null
      )
      .reduce(
        (prev, cur) => prev || cur, false
      )
    )
  }

  function findAbbreviation(str: string) {
    switch (str) {
      case "Platinum":
        return "Pt"
      default:
        return str.replace(/[a-z ]/g, "")
    }
  }

})();
