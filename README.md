# UserScripts

> Scripts tested on Fennec Android with ViolentMonkey extension. Should work across different setups.

<img width="720" height="807" alt="Screenshot_20260902_185103" src="https://github.com/user-attachments/assets/4947d071-41e8-4c11-adbc-e463e74be398" />


### List of Available Scripts:

##### ToastTranslatorVoice

[Copy from here](https://raw.githubusercontent.com/StringManolo/userscripts/refs/heads/main/ToastTranslatorVoice.user.js)

Translate text when selecting it. Text shows in a small toast. When the toast is clicked you will hear the word. The script searchs for a native speaker reading the word using wiktionary.org. If the audio is not found, defaults to google translate.

<img width="720" height="481" alt="Screenshot_20260902_190452" src="https://github.com/user-attachments/assets/2225d30d-770c-4970-ba48-aa28a8557704" />


  
> Settings
> 
> It translates by default to "es" spanish. You can change the language by editing the code and just replacing "es by "en" for english or any other language supported by Google Translate. 


  
> Privacy
> 
> The script do not collects any type of data. BUT The text is send to Google translator when selected to get an automated translation. Its also send to wiktionary.org when the toast is clicked to reproduce the audio, as the word needs to be send to their servers to find the audio file to reproduce. Google and Wiktionary use their own privacy rules.


---------

##### QuickTranslateInput

[Copy from here](https://raw.githubusercontent.com/StringManolo/userscripts/refs/heads/main/QuickTranslateInput.user.js)

Translate text by typing in a floating input. Double click (PC) or double tap with two fingers (mobile) on empty area to open the input. Write and press Enter to translate. The translation shows in a toast with a copy button. Tap the toast to hear the pronunciation of the translated word (native from wiktionary.org or Google TTS as fallback). The target language is persistent and saved locally.

<img width="720" height="1366" alt="Screenshot_20260902_200659" src="https://github.com/user-attachments/assets/123a1dec-6364-4e13-814f-3dd9740ab809" />


> Settings
>
> The target language can be changed via the dropdown selector next to the input. The selected language is automatically saved and persists between sessions. By default it translates to "es" (Spanish).

> Privacy
>
> The script does not collect any type of data. The text you write is sent to Google Translate to get the translation. When you tap the toast to hear the pronunciation, the translated word is sent to wiktionary.org to find a native audio file, or to Google TTS as fallback. Google and Wiktionary use their own privacy rules.


---------

##### Eruda Quick Access

[Copy from here](https://raw.githubusercontent.com/StringManolo/userscripts/refs/heads/main/ErudaQuickAccess.user.js)

Open/close Eruda console with a simple gesture on touch devices: tap with 1 finger, wait a moment, then tap with 2 fingers. All tools (Console, Elements, Network, Resources, Sources, Info, Snippets) are available by default. The state is persisted across pages using Violentmonkey's storage API: if you leave Eruda open, it will automatically reopen on the next page you visit.

<img width="720" height="1290" alt="Screenshot_20260902_211536" src="https://github.com/user-attachments/assets/d7f12568-ba7a-4759-963a-8fc639148a38" />


> Settings
>
> The gesture timing can be adjusted by editing the constants at the top of the script:
> - `MIN_DELAY`: minimum time (ms) between the first tap (1 finger) and the second tap (2 fingers). Default: 150.
> - `MAX_DELAY`: maximum time (ms) to complete the gesture. Default: 500.
> - `RESET_TIMEOUT`: time (ms) after which the gesture state resets if not completed. Default: 700.

> Privacy
>
> The script does not collect any type of data. It loads the Eruda library from a public CDN (`cdn.jsdelivr.net/npm/eruda`). The state (whether Eruda was active or not) is stored locally using Violentmonkey's `GM_setValue` API. This data never leaves your device and is not shared across scripts or websites.


-------

##### Dual Subs - YouTube Dual Subtitles

[Copy from here](https://raw.githubusercontent.com/StringManolo/userscripts/refs/heads/main/YTDualSubs.user.js)

Displays dual subtitles on YouTube: the original language (auto-detected from available tracks) and a translated version. Includes a simple settings panel to choose the translation language and prioritize original languages.

<img width="720" height="884" alt="Screenshot_20260902_215501" src="https://github.com/user-attachments/assets/bae864ec-45c4-4f99-b8d4-166cc7f70f60" />


> Notice:
> Activate youtube subtitles to activate the double subs automatically. It might take a bit of time to load them.
>  
> This script dosn't work for many videos (cuz the videos have no substitles available) or can stuck your video loading for a bit cuz the size of the subtitles is big or your device has low RAM.
>   
> You might need to reload the video multiple times since the youtube backend server used sometimes dosn't like the download of multiples subtitles and answers with error: TO MANY REQUESTS. 

> Settings
>
> - **Translation language**: Selectable via the floating button at the bottom right. Default is `es` (Spanish). You can change it to any language supported by Google Translate.
> - **Original language priority**: The script tries to use the first available subtitle track matching the languages you select in the panel. You can toggle checkboxes to reorder or restrict which languages are considered.
> - Changes are applied immediately and the script re-processes the current video automatically.

> Privacy
>
> The script does not collect any type of data. Subtitles are fetched directly from YouTube's own servers using the standard timedtext API. No third-party services are used.

---------

