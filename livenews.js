// Initialize a fallback API key. This acts as a default in case the .env file cannot be loaded.
let API_KEY = "b4921a2c8ed3467d84bb6329717c7fb5";

// =====================================================================
// DOM Element Caching
// =====================================================================
// We select and store these elements in variables once at the start. 
// This improves performance because JavaScript doesn't have to search 
// the entire document every time it needs to interact with these elements.
const newsContainer = document.getElementById("newsContainer");
const loader = document.getElementById("loader");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const activeSearchTag = document.getElementById("activeSearchTag");
const activeSearchValue = document.getElementById("activeSearchValue");
const clearSearchBtn = document.getElementById("clearSearch");
const categoryPills = document.querySelectorAll(".category-pill"); // Selects all elements with this class

// State variable to keep track of the currently selected category.
// This is crucial so we know what to fetch if the user clears a search.
let currentCategory = "general";

// =====================================================================
// Core Data Fetching Logic
// =====================================================================

// Fetch Helper: A reusable asynchronous function to handle all API requests.
// It takes a URL and a custom error message as arguments.
async function fetchNews(url, errorMsg) {
    // 1. Show the loading spinner before the network request starts
    loader.style.display = "flex";
    // 2. Clear out any existing news cards from the container
    newsContainer.innerHTML = "";
    
    try {
        // 3. Make the actual HTTP request to the provided URL
        const res = await fetch(url);
        
        // 4. Check if the response status is anything other than 200-299 (OK)
        // If it's a bad response, manually throw an error to jump to the catch block
        if (!res.ok) throw new Error(errorMsg);
        
        // 5. Parse the raw response body into a JavaScript object
        const data = await res.json();
        
        // 6. Pass the array of articles to our rendering function
        displayNews(data.articles);
        
    } catch (err) {
        // 7. If anything goes wrong (network failure, bad API key, etc.), 
        // catch the error and display a user-friendly error state in the UI.
        // We use escapeHTML to ensure the error message itself doesn't cause XSS issues.
        newsContainer.innerHTML = `
            <div class="state-message error">
                <span class="state-emoji">⚠️</span>
                <h2>${escapeHTML(err.message)}</h2>
                <p>Please try again later.</p>
            </div>`;
    } finally {
        // 8. The 'finally' block runs regardless of success or failure.
        // We use it to ensure the loading spinner is always hidden when the process finishes.
        loader.style.display = "none";
    }
}

// Wrapper functions for specific API endpoints:
// getNews: Fetches top headlines for a specific category (defaults to "general").
const getNews = (category = "general") => fetchNews(`https://newsapi.org/v2/top-headlines?country=us&category=${category}&apiKey=${API_KEY}`, "Failed to fetch news");

// searchNews: Fetches articles matching a specific user query using the /everything endpoint.
// encodeURIComponent ensures special characters (like spaces or &) in the search query don't break the URL.
const searchNews = (query) => fetchNews(`https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${API_KEY}`, "Search failed");

// =====================================================================
// UI Rendering Logic
// =====================================================================

// Render function: Takes the array of articles from the API and builds the HTML.
function displayNews(articles) {
    // 1. NewsAPI sometimes returns dead articles with the title "[Removed]".
    // We filter those out. The (articles || []) ensures we don't crash if articles is undefined.
    const validArticles = (articles || []).filter(a => a.title !== "[Removed]");
    
    // 2. Handle Empty State: If no valid articles exist, show a message instead of an empty screen.
    if (validArticles.length === 0) {
        newsContainer.innerHTML = `
            <div class="state-message">
                <span class="state-emoji">📭</span>
                <h2>No News Found</h2>
                <p>Try a different topic or category.</p>
            </div>`;
        return; // Exit the function early
    }

    // 3. Map over the valid articles array to generate an HTML string for each one.
    newsContainer.innerHTML = validArticles.map(article => {
        // Provide fallback data in case the API returns missing values for images, descriptions, or sources.
        const imgSrc = article.urlToImage || "https://placehold.co/640x360/1e1e2a/6c5ce7?text=No+Image";
        const description = article.description || "No description available.";
        // Optional chaining (?.) safely checks for source.name without throwing an error if source is null
        const sourceName = article.source?.name || "Unknown";
        
        // Return the HTML template for a single card.
        // ALWAYS use escapeHTML() on text directly from an API before injecting it via innerHTML 
        // to prevent Cross-Site Scripting (XSS) attacks.
        // The onerror attribute on the <img> tag catches broken image links and replaces them with the fallback.
        return `
            <div class="card">
                <div class="card-image-wrapper">
                    <img src="${imgSrc}" alt="${escapeHTML(article.title)}" loading="lazy"
                         onerror="this.src='https://placehold.co/640x360/1e1e2a/6c5ce7?text=No+Image'">
                </div>
                <div class="card-content">
                    <h3>${escapeHTML(article.title)}</h3>
                    <p class="card-description">${escapeHTML(description)}</p>
                    <div class="card-footer">
                        <span class="card-source">${escapeHTML(sourceName)}</span>
                        <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="card-link">Read</a>
                    </div>
                </div>
            </div>`;
    }).join(""); // .join("") combines the array of HTML strings into one massive string for the innerHTML
}

// =====================================================================
// Search and Interaction Handlers
// =====================================================================

// Triggered when the user searches for a specific keyword
const performSearch = () => {
    const query = searchInput.value.trim(); // Remove whitespace from ends
    
    // If input is empty, don't search. Just refocus the input box.
    if (!query) return searchInput.focus();
    
    // Visually deselect all category pills since we are now in search mode, not category mode
    categoryPills.forEach(p => p.classList.remove("active"));
    
    // Show the small visual tag indicating an active search filter
    activeSearchTag.style.display = "flex";
    activeSearchValue.textContent = query;
    
    // Execute the fetch for the specific query
    searchNews(query);
};

// Triggered when the user clears their search filter
const clearActiveSearch = (refetch) => {
    // 1. Clear the input field and the search tag text
    searchInput.value = activeSearchValue.textContent = "";
    // 2. Hide the search tag from the UI
    activeSearchTag.style.display = "none";
    
    // 3. If refetch is true, we want to go back to showing category news
    if (refetch) {
        // Re-highlight the pill that matches our saved currentCategory state
        categoryPills.forEach(p => p.classList.toggle("active", p.dataset.category === currentCategory));
        // Fetch the news for that saved category
        getNews(currentCategory);
    }
};

// =====================================================================
// Event Listeners
// =====================================================================

// Attach click events to every category pill in the navigation
categoryPills.forEach(pill => {
    pill.addEventListener("click", () => {
        // 1. Remove the "active" class from all pills, and add it only to the clicked one
        categoryPills.forEach(p => p.classList.toggle("active", p === pill));
        // 2. Update our global state to remember this new category
        currentCategory = pill.dataset.category;
        // 3. Clear any active search UI (passing false means we don't need to refetch yet)
        clearActiveSearch(false);
        // 4. Fetch news for the newly clicked category
        getNews(currentCategory);
    });
});

// Attach click event to the Search button
searchBtn.addEventListener("click", performSearch);

// Attach a keyboard listener to the search input field so the user can press "Enter" to search
searchInput.addEventListener("keydown", e => e.key === "Enter" && performSearch());

// Attach click event to the "Clear" (X) button on the active search tag
clearSearchBtn.addEventListener("click", () => clearActiveSearch(true));

// =====================================================================
// Utility Functions & App Initialization
// =====================================================================

// Data Sanitization Helper: Converts potentially dangerous characters into safe HTML entities.
// Example: <script> becomes &lt;script&gt; so the browser renders it as text, not executable code.
const escapeHTML = str => {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
};

// Initialize App: An Immediately Invoked Function Expression (IIFE).
// This async function defines itself and runs immediately when the script loads.
(async function initApp() {
    try {
        // 1. Attempt to fetch a local '.env' file to securely load the API key without hardcoding it
        const res = await fetch('.env');
        if (!res.ok) throw new Error("Failed to fetch .env");
        
        // 2. Read the file contents as text
        const text = await res.text();
        
        // 3. Use Regular Expressions (Regex) to find the string "API_KEY=" and capture everything after it
        const match = text.match(/API_KEY=(.*)/);
        
        // 4. If found, trim whitespace and overwrite the global API_KEY variable
        if (match) API_KEY = match[1].trim();
        
    } catch (e) {
        // 5. If the fetch fails (common when running locally via file:// due to CORS), log a warning.
        // The app will fall back to the hardcoded API_KEY at the top of the file.
        console.error("Warning: Could not load .env file. If you are opening this via file://, fetch('.env') won't work due to browser CORS policies. Please use a local server like VS Code Live Server.", e);
    }
    
    // 6. Final safety check: If there is absolutely no API key available
    if (!API_KEY) {
        document.getElementById("loader").style.display = "none";
        document.getElementById("newsContainer").innerHTML = `
            <div class="state-message error">
                <span class="state-emoji">⚠️</span>
                <h2>API Key Missing</h2>
                <p>Could not load <code>.env</code> file. <br>Make sure you are running a local server (e.g., Live Server) so the browser can read the file.</p>
            </div>`;
        return; // Stop the app from trying to fetch news
    }
    
    // 7. If everything is good, trigger the initial fetch to populate the homepage with "general" news
    getNews();
})();
