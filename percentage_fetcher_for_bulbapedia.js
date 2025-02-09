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
  var locations_table_class = "location_table_Obs7o"

  var body = document.querySelector("body")
  body.style.background = "cyan"

  var game_locations = document.querySelector("#Game_locations")
  var game_locations_table = game_locations.parentNode.nextSibling.nextSibling
  game_locations_table.style.borderWidth = "10px"
  game_locations_table.classList.add(locations_table_class)
  var generation_tables = document.querySelectorAll(`.${locations_table_class}>tbody>tr>td>table`)
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

      console.log(game_names.join(",") + ": ")

      routes.forEach((route) => {
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
          var routehref = route.href
          var hasHeading = routehref.includes('#')
          if (!hasHeading) {
            route.href = `${routehref}#${generation_name.replace(" ", "_")}`
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


