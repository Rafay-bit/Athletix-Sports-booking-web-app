import re
import sys

def main():
    try:
        with open('athletix_landing_claude.html', 'r', encoding='utf-8') as f:
            content = f.read()

        # Try to find the exact image tag inside the figure-wrap and replace it.
        # Looking at lines 902-904:
        # <div class="figure-wrap" id="figWrap">
        #     <img class="figure-img fig-casual" id="figCasual"
        #         src="data:image/png;base64,...">
        
        pattern = r'(<div class="figure-wrap"\s*id="figWrap">.*?<img class="figure-img fig-casual"\s*id="figCasual"\s*src=")(data:image/png;base64,[^"]*)(".*?>)'
        
        if re.search(pattern, content, re.DOTALL):
            new_content = re.sub(pattern, r'\1api/public/assets/main.png.png\3', content, flags=re.DOTALL)
            
            with open('athletix_landing_claude.html', 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Successfully replaced.")
        else:
            # Let's try replacing the whole div if the first pattern fails
            pattern_div = r'(<div class="figure-wrap"\s*id="figWrap">)(.*?)(</div>)'
            match = re.search(pattern_div, content, flags=re.DOTALL)
            if match:
                replacement = r'\1\n            <img class="figure-img fig-casual" id="figCasual" src="api/public/assets/main.png.png">\n        \3'
                new_content = re.sub(pattern_div, replacement, content, flags=re.DOTALL)
                with open('athletix_landing_claude.html', 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print("Successfully replaced div content.")
            else:
                print("Could not find the target to replace.")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    main()
