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
(function () {
    'use strict';
    // Settings START
    const locations_table_class = "location_table_Obs7o";
    const percentage_display_color = "rgb(128, 35, 160)";
    const wait_period = 3000; // be very careful when lowering this number. If you are impatient, you can. But note that you will be requesting from API much faster, and you increase your risk of your IP being banned from the wiki
    // Settings END
    const pokemon_regex = /^http.*?\/wiki\/(?<pokemon>.*?)_\(Pok\%C3\%A9mon\)(#.*)?/;
    const IMPOSSIBLE = " This error should never happen.";
    const STANDARD_ERROR_END = " Report a bug if you see this.";
    const NOT_EMPTY_BUT_NO_FIRST = "Array was found to not be empty, yet no first element was found." + IMPOSSIBLE + STANDARD_ERROR_END;
    const NO_GAME_LOCATION_TEXT = "Attempted to run percentage fetcher script on pokemon page, but no \"#Game_location\" was found." + STANDARD_ERROR_END;
    const NO_GENERATION_NAME_TEXT = "Failed to find the given generation's name for this table." + STANDARD_ERROR_END;
    const NO_INNER_GENERATION_TABLE_TEXT = "Failed to find the inner most generation table Element." + STANDARD_ERROR_END;
    const NO_HREF_IN_ANCHOR = "A link to a route didn't contain a url to link to." + STANDARD_ERROR_END;
    const NO_HREF_IN_ANCHOR_DESPITE_FOUND_EARLIER = "A link which was found to have a url it linked to earlier, now doesn't have one all of a sudden." + IMPOSSIBLE + STANDARD_ERROR_END;
    const NO_TEXT_FOUND_IN_TABLE_CELL_DESPITE_CAPTURING_ONLY_TEXT_TABLE_CELL = "Text was not found in a given Table Cell Element (td/th) despite this code only running on Table Cells captured that had text in them." + IMPOSSIBLE + STANDARD_ERROR_END;
    const GIVEN_SECTION_NOT_FOUND = "Failed to find the correct section to scan tables from." + STANDARD_ERROR_END;
    let queuedRouteLinkTasks = [];
    const is_pokemon_page = matchCurrentUrl(pokemon_regex);
    if (is_pokemon_page === null) {
        return;
    }
    setInterval(handleQueuedRouteLinkTasks, wait_period);
    const game_locations = document.querySelector("#Game_locations");
    if (!game_locations) {
        console.error(NO_GAME_LOCATION_TEXT);
        return;
    }
    const game_locations_table = game_locations.parentElement.nextElementSibling;
    game_locations_table.classList.add(locations_table_class);
    const generation_tables = document.querySelectorAll(`.${locations_table_class}>tbody>tr>td>table`);
    modify_generation_tables(generation_tables);
    function handleQueuedRouteLinkTasks() {
        if (queuedRouteLinkTasks.length <= 0) {
            return;
        }
        const task = queuedRouteLinkTasks.shift();
        if (!task) {
            console.error(NOT_EMPTY_BUT_NO_FIRST);
            return;
        }
        FetchPercentageFromAPI(task);
    }
    function modify_generation_tables(generation_tables) {
        let generation_table_index = 0;
        generation_tables.forEach((generation_table) => {
            const this_generation_table_class = "generation_table_31Lhg_" + generation_table_index;
            generation_table.classList.add(this_generation_table_class);
            const generation_name_element = document.querySelector(`.${this_generation_table_class}>tbody>tr>th>*`);
            if (!generation_name_element) {
                console.error(NO_GENERATION_NAME_TEXT);
                return;
            }
            const generation_name = generation_name_element.textContent;
            const inner_generation_table_class = "inner_generation_table_W6Wd8_" + generation_table_index;
            const inner_generation_table = document.querySelector(`.${this_generation_table_class}>tbody>tr>td>table`);
            if (!inner_generation_table) {
                console.error(NO_INNER_GENERATION_TABLE_TEXT);
                return;
            }
            inner_generation_table.classList.add(inner_generation_table_class);
            const route_set_game_names = document.querySelectorAll(`.${inner_generation_table_class}>tbody>tr`);
            const route_sets = document.querySelectorAll(`.${inner_generation_table_class}>tbody>tr>td>table>tbody>tr>td`);
            let route_set_index = 0;
            route_sets.forEach((route_set) => {
                const game_names = Array.from(route_set_game_names[route_set_index].querySelectorAll("th>a>span")).map((el) => el.textContent).filter((txt) => txt !== null).map((txt) => txt.trim());
                const routes = route_set.querySelectorAll("a");
                routes.forEach((route) => {
                    if (generation_name === null) {
                        console.error(NO_GENERATION_NAME_TEXT);
                        return;
                    }
                    const shouldBetterLink = checkIfShouldBetterLink({ route, generation_name, game_names });
                    if (shouldBetterLink) {
                        makeRouteLinkBetter({ route, generation_name, game_names });
                    }
                });
                route_set_index++;
            });
            generation_table_index++;
        });
    }
    function getPokemonNameFromCurrentUrl() {
        return matchCurrentUrl(pokemon_regex).groups.pokemon;
    }
    function matchCurrentUrl(regex) {
        return document.URL.match(regex);
    }
    function makeRouteLinkBetter(info) {
        const routehref = info.route.getAttribute("href");
        if (routehref === null) {
            console.error(NO_HREF_IN_ANCHOR_DESPITE_FOUND_EARLIER);
            return;
        }
        const linked_page = routehref.replace(/^\/wiki\//, "");
        const percentageAccordingToLocalStore = searchLocalStore(getPokemonNameFromCurrentUrl(), linked_page, info.game_names);
        if (percentageAccordingToLocalStore !== null && !isNaN(percentageAccordingToLocalStore)) {
            appendNumToLink(info.route, percentageAccordingToLocalStore);
        }
        else {
            queueRouteLink(info);
        }
    }
    function searchLocalStore(pokemon_name, route_name, game_names) {
        const id = getLocalStoreKVIDFromIdenfifyingInfo(pokemon_name, route_name, game_names);
        const value = localStorage.getItem(id);
        if (value !== null) {
            return Number(value);
        }
        else {
            return null;
        }
    }
    function setLocalStoreKV(pokemon_name, route_name, game_names, value) {
        const id = getLocalStoreKVIDFromIdenfifyingInfo(pokemon_name, route_name, game_names);
        localStorage.setItem(id, value.toString());
    }
    function getLocalStoreKVIDFromIdenfifyingInfo(pokemon_name, route_name, game_names) {
        return `${game_names.sort().map((name) => findAbbreviation(name)).join(",")}@${route_name}:${pokemon_name}`;
    }
    function queueRouteLink(info) {
        queuedRouteLinkTasks.push(info);
    }
    function checkIfShouldBetterLink(routeInfo) {
        // Not a link
        const routehref = routeInfo.route.getAttribute("href");
        if (routehref === null) {
            console.error(NO_HREF_IN_ANCHOR);
            return false;
        }
        // Route link links to something blacklisted
        const is_link_blacklisted = matchOneOfTheFollowing(routeInfo.route.href, [
            pokemon_regex,
            /\/Pok\%C3\%A9mon_breeding$/,
            /\/Time$/,
            /\/Evolution$/,
            /\/Route$/,
            /\/.*?_Rod$/,
            /\/Pok\%C3\%A9mon_Egg$/,
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
            /\/Horde_Encounter$/,
            /\/Max_Raid_Battle$/,
            /\/Wild_Area_News$/,
            /\/Wanderer$/,
            /\/White_Forest$/,
            /\/Dual-slot_mode(#.*?)?$/,
            /\/Days_of_the_week(#.*?)?$/,
            /\/Headbutt_tree$/,
            /\/Primo$/
        ]);
        if (is_link_blacklisted) {
            return false;
        }
        let is_game_blacklisted = false;
        routeInfo.game_names.forEach((game_name) => {
            if (matchOneOfTheFollowing(game_name, [
                /\/Pok\%C3\%A9walker$/,
                /Legends: Arceus/,
                /Dream World/,
                /XD/,
                /Colosseum/,
            ])) {
                is_game_blacklisted = true;
            }
        });
        if (is_game_blacklisted) {
            return false;
        }
        return true;
    }
    async function FetchPercentageFromAPI(info) {
        const { route, generation_name, game_names } = info;
        const routehref = route.getAttribute("href");
        if (routehref === null) {
            console.error(NO_HREF_IN_ANCHOR_DESPITE_FOUND_EARLIER);
            return;
        }
        const linked_page = routehref.replace(/^\/wiki\//, "");
        const percentage_winner = await fetch(`https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=${linked_page}&format=json`).then((res) => {
            if (res.status !== 200) {
                throw new Error(`There was an error with status code ${res.status}`);
            }
            return res.json();
        }).then((res) => res.parse.text["*"]).then((res) => HTMLStringToDocument(res)).then((doc) => {
            const section_name = getRelevantSectionName(doc, generation_name);
            return {
                document: doc,
                relavant_section: section_name
            };
        }).then((res) => {
            modifyHref(route, res.relavant_section);
            return TableElementListInSection(res.document, res.relavant_section);
        }).then((tablesInSection) => TablesToSubtables(tablesInSection, getPokemonNameFromCurrentUrl())).then((subtables) => subtables.map((subtable) => SubtableToGameBuckets(subtable, game_names))).then((game_bucket_groups) => {
            let game_buckets_as_array = [];
            game_bucket_groups.forEach(game_bucket_group => {
                Object.keys(game_bucket_group).forEach(game_named_bucket => {
                    game_buckets_as_array.push(game_bucket_group[game_named_bucket]);
                });
            });
            return game_buckets_as_array;
        }).then((game_buckets_as_array) => game_buckets_as_array.map((game_bucket) => game_bucket.map((row) => tableRowToPercentageArray(row)))).then((percentage_array_groups) => collapsePercentageArrayGroupsToMergedRows(percentage_array_groups)).then((merged_rows) => merged_rows.map((merged_row) => getHighestProcentageFromArray(merged_row)))
            .then((merged_row) => getHighestProcentageFromArray(merged_row));
        appendNumToLink(route, Number(percentage_winner));
        setLocalStoreKV(getPokemonNameFromCurrentUrl(), linked_page, info.game_names, Number(percentage_winner));
    }
    function getRelevantSectionName(doc, generation_name) {
        var _a, _b;
        const generation_name_underscored = generation_name.replace(" ", "_");
        const captureSiblingWithSimilarNameToGeneration = (it_el) => {
            const span = it_el.querySelector("span");
            if (span === null) {
                return false;
            }
            else {
                return span.id.match(new RegExp(`${generation_name_underscored}(_\d)?`)) !== null;
            }
        };
        const pokemonIDedElement = doc.querySelector("#Pokémon");
        if (pokemonIDedElement == null) {
            console.error(`Something went wrong finding the Pokémon id'ed element. Page is: ${(_a = doc.querySelector("#firstHeading span")) === null || _a === void 0 ? void 0 : _a.textContent}`);
            return "Pokémon";
        }
        const pokemonIDedParent = pokemonIDedElement === null || pokemonIDedElement === void 0 ? void 0 : pokemonIDedElement.parentElement;
        if (pokemonIDedParent == null) {
            console.error(`This should never happen. Page is: ${(_b = doc.querySelector("#firstHeading span")) === null || _b === void 0 ? void 0 : _b.textContent}`);
            return "Pokémon";
        }
        const potentialCorrectSections = BuildArrayWithTraversal(doc.querySelector("#Pokémon").parentElement, captureSiblingWithSimilarNameToGeneration).find((el) => el && el !== null);
        return potentialCorrectSections ? potentialCorrectSections.querySelector("span").id : "Pokémon";
    }
    function appendNumToLink(anchor, num) {
        const sup = document.createElement("sup");
        const span = document.createElement("span");
        span.innerText = num + "%";
        span.style.fontWeight = "Bold";
        span.style.fontSize = "10px";
        span.style.color = "rgb(255, 255, 255)";
        span.style.background = percentage_display_color;
        span.style.marginLeft = "3px";
        span.style.padding = "1px 2px 1px 2px";
        span.style.borderRadius = "2px";
        sup.appendChild(span);
        anchor.after(sup);
    }
    function tableRowToPercentageArray(tableRow) {
        const numCaptureRegex = /(?<num>(?:\d|\.)+)%\n?/;
        const isDataRowWithPercentage = (el) => {
            const is_non_header_row = el.nodeName.toLowerCase() === "td";
            if (is_non_header_row) {
                const text = el.textContent;
                if (text === null) {
                    return false;
                }
                const is_percentage_container = text.match(numCaptureRegex);
                if (is_percentage_container !== null) {
                    return true;
                }
            }
            return false;
        };
        return BuildArrayWithTraversal(tableRow.firstElementChild, isDataRowWithPercentage).map((td) => {
            let text = td.textContent;
            if (text === null) {
                console.error(NO_TEXT_FOUND_IN_TABLE_CELL_DESPITE_CAPTURING_ONLY_TEXT_TABLE_CELL);
                return "FAILED_TD";
            }
            return text.match(numCaptureRegex).groups.num;
        });
    }
    function getHighestProcentageFromArray(array) {
        return array.sort((a, b) => +b - +a /* descending */)[0];
    }
    function modifyHref(anchor, UrlFragmentToAppend) {
        const routehref = anchor.getAttribute("href");
        if (routehref === null) {
            console.error(NO_HREF_IN_ANCHOR);
            return;
        }
        const hasHeading = routehref.includes('#');
        if (!hasHeading) {
            anchor.setAttribute("href", `${routehref}#${UrlFragmentToAppend}`);
        }
    }
    function HTMLStringToDocument(htmlStr) {
        const parser = new DOMParser();
        return parser.parseFromString(htmlStr, "text/html");
    }
    function TableElementListInSection(parsedDoc, sectionId) {
        const section_id_el = parsedDoc.querySelector(`#${sectionId}`);
        if (section_id_el === null) {
            console.error(GIVEN_SECTION_NOT_FOUND);
            return [];
        }
        const section_header = section_id_el.parentElement;
        const captureAnyTable = (element) => {
            return element.nodeName.toLowerCase() === "table";
        };
        const untilFindingAnotherHeaderOfSameTypeAsSectionHeader = (element) => {
            return element.nodeName === section_header.nodeName && element !== section_header;
        };
        return BuildArrayWithTraversal(section_header, captureAnyTable, untilFindingAnotherHeaderOfSameTypeAsSectionHeader);
    }
    function TablesToSubtables(tableElementList, target_pokemon) {
        const isRowWithGivenPokemon = (element) => {
            const is_non_header_row = element.firstElementChild.nodeName.toLowerCase() === "td";
            if (is_non_header_row) {
                const pokemon_span_candidates = element.firstElementChild.querySelectorAll("* a>span");
                const pokemon_span = Array.from(pokemon_span_candidates).find((el) => el.textContent && el.textContent.length > 0);
                if (!pokemon_span || typeof pokemon_span === 'undefined') {
                    return false;
                }
                const pokemon_in_this_row = pokemon_span.textContent;
                const has_pokemon_in_question = pokemon_in_this_row === target_pokemon;
                return has_pokemon_in_question;
            }
            return false;
        };
        const isRowSubtableSeparator = (element) => {
            let children = Array.from(element.querySelectorAll('td, th'));
            if (children.length == 1) {
                return true;
            }
            return false;
        };
        // split tables into sub tables
        // and
        // take _any_ row with isRowWithGivenPokemon
        // and
        // put rows into baskets of games the row is relevant ot (row can be in more than one basket)
        // THEN we know where to merge and where not to merge
        let subtables = (() => {
            let subtable_index = 0;
            let return_value = [];
            tableElementList.forEach(table => {
                const first_row = table.querySelector("tbody>tr");
                let traverse = first_row;
                for (let i = 0; i < 200; i++) {
                    if (traverse === null) {
                        break;
                    }
                    if (isRowWithGivenPokemon(traverse)) {
                        if (return_value.length <= subtable_index) {
                            return_value[subtable_index] = [];
                        }
                        return_value[subtable_index].push(traverse);
                    }
                    else if (isRowSubtableSeparator(traverse)) {
                        subtable_index++;
                    }
                    traverse = traverse.nextElementSibling;
                }
                subtable_index++;
            });
            return return_value;
        })();
        return subtables;
    }
    function SubtableToGameBuckets(subtable, target_games) {
        const target_games_abbr = target_games.map((game_name) => findAbbreviation(game_name));
        const game_buckets = target_games_abbr.reduce((prev, cur) => ({ ...prev, [cur]: [] }), {});
        const getGamesMarkedFromRow = (element) => {
            const captureCells = (el) => el.nodeName.toLowerCase() === "th" || el.nodeName.toLowerCase() === "td";
            const colorIsBlank = (el) => {
                const groups = el.style.background.match(/rgb\( ?(?<r>.*?), ?(?<g>.*?), ?(?<b>.*?) ?\)/).groups;
                if (!groups) {
                    return true;
                }
                const r = groups.r;
                const g = groups.g;
                const b = groups.b;
                if (r === "0" &&
                    g === "0" &&
                    b === "0") {
                    return true;
                }
                if (r === "255" &&
                    g === "255" &&
                    b === "255") {
                    return true;
                }
                return false;
            };
            const matchStrWithAnyInArr = (str, arr) => {
                return arr.filter((el) => el === str).length > 0;
            };
            const cellElements = BuildArrayWithTraversal(element.firstElementChild, captureCells, (_iterated_element) => false);
            const game_names_highlighted = [];
            cellElements.forEach(cellElement => {
                if (colorIsBlank(cellElement)) {
                    return;
                }
                let cellChild = cellElement.firstElementChild;
                if (cellChild === null) {
                    // ASSUMPTION: The cellElement for games never just
                    // contain textContent directly. It is always within
                    // some element (possibly an anchor) as it needs
                    // to link to the game in question
                    return;
                }
                let text = cellChild.textContent;
                if (text === null) {
                    return;
                }
                if (matchStrWithAnyInArr(text, target_games_abbr)) {
                    game_names_highlighted.push(text);
                    return;
                }
                return;
            });
            return game_names_highlighted;
        };
        subtable.forEach(row => {
            let game_names = getGamesMarkedFromRow(row);
            game_names.forEach(game_name => {
                game_buckets[game_name].push(row);
            });
        });
        return game_buckets;
    }
    function collapsePercentageArrayGroupsToMergedRows(percentage_array_groups) {
        return percentage_array_groups.map((percentage_array_group) => percentage_array_group
            .reduce((prev, curr) => {
            let new_arr = [];
            let new_arr_length = Math.max(prev.length, curr.length);
            for (let i = 0; i < new_arr_length; i++) {
                let prev_at_index = prev.length >= new_arr_length ? prev[new_arr_length - i - 1] : "0";
                let curr_at_index = curr.length >= new_arr_length ? curr[new_arr_length - i - 1] : "0";
                new_arr[new_arr_length - i - 1] = (+prev_at_index + +curr_at_index).toString();
            }
            return new_arr;
        }));
    }
    function BuildArrayWithTraversal(startElement, captureFunc, untilFunc = (_it_el) => false, tries = 20) {
        const buildArray = [];
        let traverse = startElement;
        for (let i = 0; i < tries; i++) {
            if (traverse === null) {
                break;
            }
            if (untilFunc(traverse)) {
                break;
            }
            if (captureFunc(traverse)) {
                buildArray.push(traverse);
            }
            traverse = traverse.nextElementSibling;
        }
        return buildArray;
    }
    function matchOneOfTheFollowing(str, possibleMatch) {
        return (possibleMatch
            .map((m) => str.match(m) !== null)
            .reduce((prev, cur) => prev || cur, false));
    }
    function findAbbreviation(str) {
        switch (str) {
            case "Platinum":
                return "Pt";
            default:
                return str.replace(/[a-z ]/g, "");
        }
    }
})();
