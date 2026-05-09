// FORGE LinkedIn Extractor — runs on linkedin.com/company/* and linkedin.com/in/*

(function () {
  /**
   * Robust text extraction that handles obfuscated classes by looking for 
   * semantic hints and relative positioning.
   */
  const EXTRACTOR = {
    getCleanText(el) {
      if (!el) return "";
      // Remove hidden elements and clean up whitespace
      return el.innerText.trim().replace(/\s+/g, ' ');
    },

    getSectionByHeading(headingText) {
      const sections = document.querySelectorAll('section');
      for (const section of sections) {
        const h2 = section.querySelector('h2, h3');
        if (h2 && h2.innerText.includes(headingText)) {
          return section;
        }
      }
      return null;
    },

    extractPerson() {
      // 1. Find the Top Card section
      // In 2026 LinkedIn, this often has a componentkey with 'Topcard'
      const topCard = document.querySelector('section[componentkey*="Topcard"]') || 
                      document.querySelector('main section') || 
                      document.querySelector('.pv-top-card');
      
      if (!topCard) return null;

      // 2. Name: Usually the first h1 or h2 in the top card
      const nameEl = topCard.querySelector('h1, h2');
      const name = this.getCleanText(nameEl) || document.title.split(' | ')[0];

      // 3. Headline & Location: Look for paragraphs in the top card
      const paragraphs = Array.from(topCard.querySelectorAll('p, div'))
        .map(el => this.getCleanText(el))
        .filter(text => text.length > 2 && text !== name);

      // Headline is typically the first significant text after the name
      const headline = paragraphs.find(p => !p.includes(',') && p.length > 10) || paragraphs[0] || "";
      
      // Location typically contains a comma and is near the headline
      const geography = paragraphs.find(p => p.includes(',') && p.split(',').length >= 2) || "";

      // 4. Company: Usually a link to a company page in the top card
      const companyLink = topCard.querySelector('a[href*="/company/"]');
      const companyName = companyLink ? this.getCleanText(companyLink) : "";

      // 5. About Summary
      const aboutSection = this.getSectionByHeading('About');
      const aboutText = aboutSection ? this.getCleanText(aboutSection.querySelector('.break-words, p')) : "";

      // 6. Experience (briefly for notes)
      const expSection = this.getSectionByHeading('Experience');
      const expItems = expSection ? Array.from(expSection.querySelectorAll('li')).slice(0, 3).map(li => this.getCleanText(li)).join('\n- ') : "";

      return {
        type: "person",
        contact_name: name,
        contact_title: headline,
        geography: geography,
        company: companyName,
        description: [aboutText, expItems ? "\nRecent Experience:\n- " + expItems : ""].filter(Boolean).join('\n'),
        linkedin_url: window.location.href.split("?")[0],
        source: "LinkedIn (Chrome Extension)",
      };
    },

    extractCompany() {
      const topCard = document.querySelector('.org-top-card') || document.querySelector('main section');
      const name = this.getCleanText(document.querySelector('h1')) || 
                   this.getCleanText(document.querySelector('.org-top-card-summary__title'));
      
      const infoList = document.querySelector('.org-top-card-summary-info-list');
      const infoItems = infoList ? Array.from(infoList.querySelectorAll('div, span, li')).map(el => this.getCleanText(el)) : [];
      
      const industry = infoItems.find(item => item.length > 2 && !item.includes('employees') && !item.includes(',')) || "";
      const size = infoItems.find(item => item.includes('employees')) || "";
      const geography = infoItems.find(item => item.includes(',')) || "";

      const websiteLink = document.querySelector('a[href*="website"], a[data-control-name="topcard_website"]');
      
      const aboutSection = this.getSectionByHeading('About');
      const description = aboutSection ? this.getCleanText(aboutSection.querySelector('p')) : 
                          this.getCleanText(document.querySelector('.org-top-card-summary__tagline'));

      return {
        type: "company",
        company: name,
        website: websiteLink ? websiteLink.href : "",
        industry: industry,
        geography: geography,
        size: size,
        description: description,
        linkedin_url: window.location.href.split("?")[0],
        source: "LinkedIn Company (Chrome Extension)",
      };
    }
  };

  // Message listener for popup.js
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extract") {
      const isCompany = window.location.href.includes("/company/");
      try {
        const data = isCompany ? EXTRACTOR.extractCompany() : EXTRACTOR.extractPerson();
        if (data) {
          sendResponse({ success: true, data });
        } else {
          sendResponse({ success: false, error: "Could not find profile data on page" });
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return true;
  });
})();
