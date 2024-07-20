

/* PLAYER PAGE TABS */
const tabs = document.querySelectorAll('[data-tab-target]')
const tabContents = document.querySelectorAll('[data-tab-content]')

// click event listener to each tab
tabs.forEach(tab=>{
    tab.addEventListener('click', ()=>{

        // retrieve content element that this tab targets through value 'data-tab-target'
        const target = document.querySelector(tab.dataset.tabTarget)

        // remove the 'active' class from all content elements to hide them
        tabContents.forEach(tabContent=>{
            tabContent.classList.remove('active')
        })

        // remove the 'active' class from all tabs to indicate not selected
        tabs.forEach(tab=>{
            tab.classList.remove('active')
        })

        // add 'active' class to the selected tab and content
        tab.classList.add('active')

        // add 'active' class to the targeted content element to make it visibles
        target.classList.add('active')
    })
})