# Hyper Seek

![](https://img.shields.io/github/downloads/chrisgrieser/hyper-seek/total?label=Total%20Downloads&style=plastic) ![](https://img.shields.io/github/v/release/chrisgrieser/hyper-seek?label=Latest%20Release&style=plastic) 

[Alfred workflow](https://www.alfredapp.com/) that shows inline search results, without a keyword.

<img src="https://github.com/chrisgrieser/hyper-seek/assets/73286100/f463389a-7eda-4ecd-9d4e-00b140408523" alt="Showcase image" width=70%>

## Table of Contents
<!--toc:start-->
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
    - [Inline results](#inline-results)
    - [Global search hotkey](#global-search-hotkey)
    - [Add link to selection](#add-link-to-selection)
- [Credits](#credits)
<!--toc:end-->

## Features
- Inline Search Results, similar to Spotlight on iOS.
- Results *without* a keyword. Results are always shown alongside your other keywords.
- Multi-Selection of URLs to open.
- Global Search Hotkey: Search for terms, open URLs, write mails, etc.
- Add link to selected text: Turns selected text into a Markdown link. 

## Installation
1. [➡️ Download the latest release of the workflow.](https://github.com/chrisgrieser/hyper-seek/releases/latest)
2. Add this workflow as [fallback search](https://www.alfredapp.com/help/features/default-results/fallback-searches/).

*An earlier version of this workflow required `ddgr`. However, `ddgr` is not required anymore.*

__Auto-Update__  
Due to the nature of this workflow, it is not going to be submitted to the Alfred Gallery. Therefore, the workflow includes its own auto-update function.

## Usage

### Inline results
Typing anything in Alfred shows inline search results. You do not need to use a keyword. 
- <kbd>⏎</kbd>: Search for the query term, or open result.
- <kbd>⌘</kbd><kbd>⏎</kbd>: Multi-Select: (de)select the URL. The next <kbd>⏎</kbd> opens the selected result as well as all URLs marked before. 
- <kbd>⌥</kbd><kbd>⏎</kbd>: Copy URL to clipboard. 
- <kbd>⌥</kbd> (hold): Show full URL.
- <kbd>⇧</kbd> (hold): Show preview text of search result. 

> [!NOTE]  
> In the [Alfred Advanced Settings](https://www.alfredapp.com/help/advanced/), set <kbd>⌃</kbd><kbd>⏎</kbd> to `Action all visible results`. This allows you to open all search results at once. 

### Global search hotkey 
Configure the [hotkey](https://www.alfredapp.com/help/workflows/triggers/hotkey/) to be able to search for any selection. The resulting action depends on the type of text selected:
- file path → reveal file in Finder 
- directory path → open directory in Finder 
- URL → open in default browser 
- eMail → send eMail to that address in your default mail app 
- Some other text → search for selection & open first search result (`I'm feeling lucky`) 

### Add link to selection 
Configure another [hotkey](https://www.alfredapp.com/help/workflows/triggers/hotkey/) to turn selected text into a Markdown link, with the URL of the first search result for that text as URL of the Markdown link. This feature is essentially a simplified version of [Brett Terpstra's SearchLink](https://brettterpstra.com/projects/searchlink/). 

## License
- `ddgr` is included in this project and licensed under [GNU GPL v3](https://github.com/kometenstaub/ddgr/blob/main/LICENSE).
- `Hyper Seek` is licensed under the [MIT License](https://github.com/chrisgrieser/hyper-seek/blob/main/LICENSE).

## Credits
<!-- vale Google.FirstPerson = NO -->
**About Me**  
In my day job, I am a sociologist studying the social mechanisms underlying the digital economy. For my PhD project, I investigate the governance of the app economy and how software ecosystems manage the tension between innovation and compatibility. If you are interested in this subject, feel free to get in touch.

**Profiles**  
- [reddit](https://www.reddit.com/user/pseudometapseudo)
- [Discord](https://discordapp.com/users/462774483044794368/)
- [Academic Website](https://chris-grieser.de/)
- [Mastodon](https://pkm.social/@pseudometa)
- [Twitter](https://twitter.com/pseudo_meta)
- [ResearchGate](https://www.researchgate.net/profile/Christopher-Grieser)
- [LinkedIn](https://www.linkedin.com/in/christopher-grieser-ba693b17a/)

**Buy Me a Coffee**  
<br>
<a href='https://ko-fi.com/Y8Y86SQ91' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://cdn.ko-fi.com/cdn/kofi1.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
