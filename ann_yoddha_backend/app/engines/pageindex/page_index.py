"""
PageIndex: Hierarchical PDF structure extractor.
Vendored from the upstream PageIndex library into app/services/pageindex.
"""

import os
import json
import copy
import math
import random
import re
import asyncio
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed

from .utils import (
    count_tokens,
    ChatGPT_API,
    ChatGPT_API_with_finish_reason,
    ChatGPT_API_async,
    extract_json,
    get_json_content,
    write_node_id,
    get_nodes,
    structure_to_list,
    get_leaf_nodes,
    is_leaf_node,
    get_last_node,
    extract_text_from_pdf,
    get_pdf_title,
    get_text_of_pages,
    get_page_tokens,
    get_text_of_pdf_pages,
    get_text_of_pdf_pages_with_labels,
    get_number_of_pages,
    JsonLogger,
    list_to_tree,
    add_preface_if_needed,
    post_processing,
    clean_structure_post,
    remove_fields,
    print_toc,
    print_json,
    remove_structure_text,
    check_token_limit,
    convert_physical_index_to_int,
    convert_page_to_int,
    add_node_text,
    add_node_text_with_labels,
    generate_node_summary,
    generate_summaries_for_structure,
    create_clean_structure_for_description,
    generate_doc_description,
    reorder_dict,
    format_structure,
    ConfigLoader,
    get_pdf_name,
    sanitize_filename,
)


# ─── LLM helpers ──────────────────────────────────────────────────────────────

def llm_completion(model=None, prompt=None, chat_history=None, return_finish_reason=False):
    if return_finish_reason:
        return ChatGPT_API_with_finish_reason(model, prompt, chat_history=chat_history)
    return ChatGPT_API(model, prompt, chat_history=chat_history)


async def llm_acompletion(model=None, prompt=None):
    return await ChatGPT_API_async(model, prompt)


# ─── Title-appearance checks ───────────────────────────────────────────────────

async def check_title_appearance(item, page_list, start_index=1, model=None):
    title = item['title']
    if 'physical_index' not in item or item['physical_index'] is None:
        return {'list_index': item.get('list_index'), 'answer': 'no', 'title': title, 'page_number': None}

    page_number = item['physical_index']
    page_text = page_list[page_number - start_index][0]

    prompt = f"""
    Your job is to check if the given section appears or starts in the given page_text.
    Note: do fuzzy matching, ignore any space inconsistency in the page_text.
    The given section title is {title}.
    The given page_text is {page_text}.
    Reply format:
    {{
        "thinking": <why do you think the section appears or starts in the page_text>
        "answer": "yes or no"
    }}
    Directly return the final JSON structure. Do not output anything else."""

    response = await llm_acompletion(model=model, prompt=prompt)
    response = extract_json(response)
    answer = response.get('answer', 'no')
    return {'list_index': item['list_index'], 'answer': answer, 'title': title, 'page_number': page_number}


async def check_title_appearance_in_start(title, page_text, model=None, logger=None):
    prompt = f"""
    You will be given the current section title and the current page_text.
    Your job is to check if the current section starts in the beginning of the given page_text.
    If there are other contents before the current section title, then the current section does not start in the beginning of the given page_text.
    If the current section title is the first content in the given page_text, then the current section starts in the beginning.
    Note: do fuzzy matching, ignore any space inconsistency in the page_text.
    The given section title is {title}.
    The given page_text is {page_text}.
    reply format:
    {{
        "thinking": <why do you think the section appears or starts in the page_text>
        "start_begin": "yes or no"
    }}
    Directly return the final JSON structure. Do not output anything else."""

    response = await llm_acompletion(model=model, prompt=prompt)
    response = extract_json(response)
    if logger:
        logger.info(f"Response: {response}")
    return response.get("start_begin", "no")


async def check_title_appearance_in_start_concurrent(structure, page_list, model=None, logger=None):
    if logger:
        logger.info("Checking title appearance in start concurrently")

    for item in structure:
        if item.get('physical_index') is None:
            item['appear_start'] = 'no'

    tasks = []
    valid_items = []
    for item in structure:
        if item.get('physical_index') is not None:
            page_text = page_list[item['physical_index'] - 1][0]
            tasks.append(check_title_appearance_in_start(item['title'], page_text, model=model, logger=logger))
            valid_items.append(item)

    results = await asyncio.gather(*tasks, return_exceptions=True)
    for item, result in zip(valid_items, results):
        if isinstance(result, Exception):
            if logger:
                logger.error(f"Error checking start for {item['title']}: {result}")
            item['appear_start'] = 'no'
        else:
            item['appear_start'] = result

    return structure


# ─── TOC detection & extraction ───────────────────────────────────────────────

def toc_detector_single_page(content, model=None):
    prompt = f"""
    Your job is to detect if there is a table of content provided in the given text.
    Given text: {content}
    return the following JSON format:
    {{
        "thinking": <why do you think there is a table of content in the given text>
        "toc_detected": "<yes or no>",
    }}
    Directly return the final JSON structure. Do not output anything else.
    Please note: abstract,summary, notation list, figure list, table list, etc. are not table of contents."""

    response = llm_completion(model=model, prompt=prompt)
    json_content = extract_json(response)
    return json_content['toc_detected']


def check_if_toc_extraction_is_complete(content, toc, model=None):
    prompt = (
        "You are given a partial document and a table of contents.\n"
        "Your job is to check if the table of contents is complete.\n"
        'Reply format:\n{{\n    "thinking": <...>\n    "completed": "yes" or "no"\n}}\n'
        "Directly return the final JSON structure. Do not output anything else."
        f"\n Document:\n{content}\n Table of contents:\n{toc}"
    )
    response = llm_completion(model=model, prompt=prompt)
    return extract_json(response)['completed']


def check_if_toc_transformation_is_complete(content, toc, model=None):
    prompt = (
        "You are given a raw table of contents and a table of contents.\n"
        "Your job is to check if the table of contents is complete.\n"
        'Reply format:\n{{\n    "thinking": <...>\n    "completed": "yes" or "no"\n}}\n'
        "Directly return the final JSON. Do not output anything else."
        f"\n Raw Table of contents:\n{content}\n Cleaned Table of contents:\n{toc}"
    )
    response = llm_completion(model=model, prompt=prompt)
    return extract_json(response)['completed']


def extract_toc_content(content, model=None):
    prompt = f"""
    Your job is to extract the full table of contents from the given text, replace ... with :
    Given text: {content}
    Directly return the full table of contents content. Do not output anything else."""

    response, finish_reason = llm_completion(model=model, prompt=prompt, return_finish_reason=True)
    if_complete = check_if_toc_transformation_is_complete(content, response, model)
    if if_complete == "yes" and finish_reason == "finished":
        return response

    chat_history = [
        {"role": "user", "content": prompt},
        {"role": "assistant", "content": response},
    ]
    prompt2 = "please continue the generation of table of contents, directly output the remaining part of the structure"
    new_response, finish_reason = llm_completion(model=model, prompt=prompt2, chat_history=chat_history, return_finish_reason=True)
    response = response + new_response
    if_complete = check_if_toc_transformation_is_complete(content, response, model)

    attempt = 0
    max_attempts = 5
    while not (if_complete == "yes" and finish_reason == "finished"):
        attempt += 1
        if attempt > max_attempts:
            raise Exception('Failed to complete table of contents after maximum retries')
        chat_history = [{"role": "user", "content": prompt2}, {"role": "assistant", "content": response}]
        new_response, finish_reason = llm_completion(model=model, prompt=prompt2, chat_history=chat_history, return_finish_reason=True)
        response = response + new_response
        if_complete = check_if_toc_transformation_is_complete(content, response, model)

    return response


def detect_page_index(toc_content, model=None):
    print('start detect_page_index')
    prompt = f"""
    You will be given a table of contents.
    Your job is to detect if there are page numbers/indices given within the table of contents.
    Given text: {toc_content}
    Reply format:
    {{
        "thinking": <...>
        "page_index_given_in_toc": "<yes or no>"
    }}
    Directly return the final JSON structure. Do not output anything else."""

    response = llm_completion(model=model, prompt=prompt)
    return extract_json(response)['page_index_given_in_toc']


def toc_extractor(page_list, toc_page_list, model):
    def transform_dots_to_colon(text):
        text = re.sub(r'\.{5,}', ': ', text)
        text = re.sub(r'(?:\. ){5,}\.?', ': ', text)
        return text

    toc_content = ""
    for page_index in toc_page_list:
        toc_content += page_list[page_index][0]
    toc_content = transform_dots_to_colon(toc_content)
    has_page_index = detect_page_index(toc_content, model=model)
    return {"toc_content": toc_content, "page_index_given_in_toc": has_page_index}


def toc_index_extractor(toc, content, model=None):
    print('start toc_index_extractor')
    toc_extractor_prompt = """
    You are given a table of contents in a json format and several pages of a document, your job is to add the physical_index to the table of contents.
    The provided pages contains tags like <physical_index_X> and <physical_index_X> to indicate the physical location of the page X.
    The response should be in the following JSON format:
    [{"structure": <...>, "title": <...>, "physical_index": "<physical_index_X>"},...]
    Only add the physical_index to the sections that are in the provided pages.
    Directly return the final JSON structure. Do not output anything else."""

    prompt = toc_extractor_prompt + '\nTable of contents:\n' + str(toc) + '\nDocument pages:\n' + content
    response = llm_completion(model=model, prompt=prompt)
    return extract_json(response)


def toc_transformer(toc_content, model=None):
    print('start toc_transformer')
    init_prompt = """
    You are given a table of contents. Transform the whole table of content into a JSON format.
    structure is the numeric system, e.g. first section = "1", first subsection = "1.1".
    The response should be in the following JSON format:
    {"table_of_contents": [{"structure": <...>, "title": <...>, "page": <page number or None>}, ...]}
    Directly return the final JSON structure, do not output anything else."""

    prompt = init_prompt + '\n Given table of contents\n:' + toc_content
    last_complete, finish_reason = llm_completion(model=model, prompt=prompt, return_finish_reason=True)
    if_complete = check_if_toc_transformation_is_complete(toc_content, last_complete, model)
    if if_complete == "yes" and finish_reason == "finished":
        last_complete = extract_json(last_complete)
        return convert_page_to_int(last_complete['table_of_contents'])

    last_complete = get_json_content(last_complete)
    attempt = 0
    max_attempts = 5
    while not (if_complete == "yes" and finish_reason == "finished"):
        attempt += 1
        if attempt > max_attempts:
            raise Exception('Failed to complete toc transformation after maximum retries')
        position = last_complete.rfind('}')
        if position != -1:
            last_complete = last_complete[:position + 2]
        prompt = (
            f"Continue the table of contents json structure, directly output the remaining part.\n"
            f"Raw TOC:\n{toc_content}\nIncomplete JSON:\n{last_complete}\n"
            "Please continue the json structure, directly output the remaining part."
        )
        new_complete, finish_reason = llm_completion(model=model, prompt=prompt, return_finish_reason=True)
        if new_complete.startswith('```json'):
            new_complete = get_json_content(new_complete)
        last_complete = last_complete + new_complete
        if_complete = check_if_toc_transformation_is_complete(toc_content, last_complete, model)

    last_complete = extract_json(last_complete)
    return convert_page_to_int(last_complete['table_of_contents'])


# ─── Find TOC pages ────────────────────────────────────────────────────────────

def find_toc_pages(start_page_index, page_list, opt, logger=None):
    print('start find_toc_pages')
    last_page_is_yes = False
    toc_page_list = []
    i = start_page_index
    while i < len(page_list):
        if i >= opt.toc_check_page_num and not last_page_is_yes:
            break
        detected_result = toc_detector_single_page(page_list[i][0], model=opt.model)
        if detected_result == 'yes':
            if logger:
                logger.info(f'Page {i} has toc')
            toc_page_list.append(i)
            last_page_is_yes = True
        elif detected_result == 'no' and last_page_is_yes:
            break
        i += 1
    if not toc_page_list and logger:
        logger.info('No toc found')
    return toc_page_list


def remove_page_number(data):
    if isinstance(data, dict):
        data.pop('page_number', None)
        for key in list(data.keys()):
            if 'nodes' in key:
                remove_page_number(data[key])
    elif isinstance(data, list):
        for item in data:
            remove_page_number(item)
    return data


def extract_matching_page_pairs(toc_page, toc_physical_index, start_page_index):
    pairs = []
    for phy_item in toc_physical_index:
        for page_item in toc_page:
            if phy_item.get('title') == page_item.get('title'):
                physical_index = phy_item.get('physical_index')
                if physical_index is not None and int(physical_index) >= start_page_index:
                    pairs.append({
                        'title': phy_item.get('title'),
                        'page': page_item.get('page'),
                        'physical_index': physical_index,
                    })
    return pairs


def calculate_page_offset(pairs):
    differences = []
    for pair in pairs:
        try:
            differences.append(pair['physical_index'] - pair['page'])
        except (KeyError, TypeError):
            continue
    if not differences:
        return None
    counts = {}
    for d in differences:
        counts[d] = counts.get(d, 0) + 1
    return max(counts.items(), key=lambda x: x[1])[0]


def add_page_offset_to_toc_json(data, offset):
    for i in range(len(data)):
        if data[i].get('page') is not None and isinstance(data[i]['page'], int):
            data[i]['physical_index'] = data[i]['page'] + offset
            del data[i]['page']
    return data


# ─── Group pages ──────────────────────────────────────────────────────────────

def page_list_to_group_text(page_contents, token_lengths, max_tokens=20000, overlap_page=1):
    num_tokens = sum(token_lengths)
    if num_tokens <= max_tokens:
        return ["".join(page_contents)]

    subsets = []
    current_subset = []
    current_token_count = 0
    expected_parts_num = math.ceil(num_tokens / max_tokens)
    average_tokens_per_part = math.ceil(((num_tokens / expected_parts_num) + max_tokens) / 2)

    for i, (page_content, page_tokens) in enumerate(zip(page_contents, token_lengths)):
        if current_token_count + page_tokens > average_tokens_per_part:
            subsets.append(''.join(current_subset))
            overlap_start = max(i - overlap_page, 0)
            current_subset = page_contents[overlap_start:i]
            current_token_count = sum(token_lengths[overlap_start:i])
        current_subset.append(page_content)
        current_token_count += page_tokens
    if current_subset:
        subsets.append(''.join(current_subset))
    print('divide page_list to groups', len(subsets))
    return subsets


# ─── TOC page-number adder ────────────────────────────────────────────────────

def add_page_number_to_toc(part, structure, model=None):
    fill_prompt_seq = """
    You are given a JSON structure and a partial document. Check if each section title starts in the document.
    Tags <physical_index_X> indicate page X boundaries.
    Response format:
    [{"structure": <...>, "title": <...>, "start": "<yes or no>", "physical_index": "<physical_index_X> or None"}, ...]
    Directly return the final JSON structure. Do not output anything else."""

    prompt = fill_prompt_seq + f"\n\nCurrent Partial Document:\n{part}\n\nGiven Structure\n{json.dumps(structure, indent=2)}\n"
    current_json_raw = llm_completion(model=model, prompt=prompt)
    json_result = extract_json(current_json_raw)
    for item in json_result:
        if 'start' in item:
            del item['start']
    return json_result


def generate_toc_continue(toc_content, part, model=None):
    print('start generate_toc_continue')
    prompt = """
    You are an expert in extracting hierarchical tree structure.
    You are given a tree structure of the previous part and the text of the current part.
    Continue the tree structure to include the current part.
    Tags <physical_index_X> indicate page X boundaries.
    Response format:
    [{"structure": <...>, "title": <...>, "physical_index": "<physical_index_X>"}, ...]
    Directly return the additional part of the final JSON structure. Do not output anything else."""

    prompt = prompt + '\nGiven text\n:' + part + '\nPrevious tree structure\n:' + json.dumps(toc_content, indent=2)
    response, finish_reason = llm_completion(model=model, prompt=prompt, return_finish_reason=True)
    if finish_reason == 'finished':
        return extract_json(response)
    raise Exception(f'finish reason: {finish_reason}')


def generate_toc_init(part, model=None):
    print('start generate_toc_init')
    prompt = """
    You are an expert in extracting hierarchical tree structure. Generate the tree structure of the document.
    structure: numeric index, e.g. "1", "1.1", "1.2".
    Tags <physical_index_X> indicate page X boundaries.
    Response format:
    [{"structure": <...>, "title": <...>, "physical_index": "<physical_index_X>"}, ...]
    Directly return the final JSON structure. Do not output anything else."""

    prompt = prompt + '\nGiven text\n:' + part
    response, finish_reason = llm_completion(model=model, prompt=prompt, return_finish_reason=True)
    if finish_reason == 'finished':
        return extract_json(response)
    raise Exception(f'finish reason: {finish_reason}')


# ─── Processing modes ─────────────────────────────────────────────────────────

def process_no_toc(page_list, start_index=1, model=None, logger=None):
    page_contents = []
    token_lengths = []
    for page_index in range(start_index, start_index + len(page_list)):
        page_text = f"<physical_index_{page_index}>\n{page_list[page_index - start_index][0]}\n<physical_index_{page_index}>\n\n"
        page_contents.append(page_text)
        token_lengths.append(count_tokens(page_text, model))
    group_texts = page_list_to_group_text(page_contents, token_lengths)
    if logger:
        logger.info(f'len(group_texts): {len(group_texts)}')

    toc_with_page_number = generate_toc_init(group_texts[0], model)
    for group_text in group_texts[1:]:
        toc_with_page_number.extend(generate_toc_continue(toc_with_page_number, group_text, model))
    if logger:
        logger.info(f'generate_toc: {toc_with_page_number}')

    toc_with_page_number = convert_physical_index_to_int(toc_with_page_number)
    return toc_with_page_number


def process_toc_no_page_numbers(toc_content, toc_page_list, page_list, start_index=1, model=None, logger=None):
    page_contents = []
    token_lengths = []
    toc_content = toc_transformer(toc_content, model)
    if logger:
        logger.info(f'toc_transformer: {toc_content}')
    for page_index in range(start_index, start_index + len(page_list)):
        page_text = f"<physical_index_{page_index}>\n{page_list[page_index - start_index][0]}\n<physical_index_{page_index}>\n\n"
        page_contents.append(page_text)
        token_lengths.append(count_tokens(page_text, model))

    group_texts = page_list_to_group_text(page_contents, token_lengths)
    if logger:
        logger.info(f'len(group_texts): {len(group_texts)}')

    toc_with_page_number = copy.deepcopy(toc_content)
    for group_text in group_texts:
        toc_with_page_number = add_page_number_to_toc(group_text, toc_with_page_number, model)

    toc_with_page_number = convert_physical_index_to_int(toc_with_page_number)
    return toc_with_page_number


def process_toc_with_page_numbers(toc_content, toc_page_list, page_list, toc_check_page_num=None, model=None, logger=None):
    toc_with_page_number = toc_transformer(toc_content, model)
    if logger:
        logger.info(f'toc_with_page_number: {toc_with_page_number}')

    toc_no_page_number = remove_page_number(copy.deepcopy(toc_with_page_number))
    start_page_index = toc_page_list[-1] + 1
    main_content = ""
    for page_index in range(start_page_index, min(start_page_index + toc_check_page_num, len(page_list))):
        main_content += f"<physical_index_{page_index + 1}>\n{page_list[page_index][0]}\n<physical_index_{page_index + 1}>\n\n"

    toc_with_physical_index = toc_index_extractor(toc_no_page_number, main_content, model)
    toc_with_physical_index = convert_physical_index_to_int(toc_with_physical_index)

    matching_pairs = extract_matching_page_pairs(toc_with_page_number, toc_with_physical_index, start_page_index)
    offset = calculate_page_offset(matching_pairs)
    if logger:
        logger.info(f'offset: {offset}')

    toc_with_page_number = add_page_offset_to_toc_json(toc_with_page_number, offset)
    toc_with_page_number = process_none_page_numbers(toc_with_page_number, page_list, model=model)
    return toc_with_page_number


def process_none_page_numbers(toc_items, page_list, start_index=1, model=None):
    for i, item in enumerate(toc_items):
        if "physical_index" not in item:
            prev_physical_index = 0
            for j in range(i - 1, -1, -1):
                if toc_items[j].get('physical_index') is not None:
                    prev_physical_index = toc_items[j]['physical_index']
                    break
            next_physical_index = -1
            for j in range(i + 1, len(toc_items)):
                if toc_items[j].get('physical_index') is not None:
                    next_physical_index = toc_items[j]['physical_index']
                    break

            page_contents = []
            for page_index in range(prev_physical_index, next_physical_index + 1):
                list_index = page_index - start_index
                if 0 <= list_index < len(page_list):
                    page_text = f"<physical_index_{page_index}>\n{page_list[list_index][0]}\n<physical_index_{page_index}>\n\n"
                    page_contents.append(page_text)

            item_copy = copy.deepcopy(item)
            item_copy.pop('page', None)
            result = add_page_number_to_toc(page_contents, item_copy, model)
            if isinstance(result[0]['physical_index'], str) and result[0]['physical_index'].startswith('<physical_index'):
                item['physical_index'] = int(result[0]['physical_index'].split('_')[-1].rstrip('>').strip())
                item.pop('page', None)
    return toc_items


def check_toc(page_list, opt=None):
    toc_page_list = find_toc_pages(start_page_index=0, page_list=page_list, opt=opt)
    if len(toc_page_list) == 0:
        print('no toc found')
        return {'toc_content': None, 'toc_page_list': [], 'page_index_given_in_toc': 'no'}

    print('toc found')
    toc_json = toc_extractor(page_list, toc_page_list, opt.model)

    if toc_json['page_index_given_in_toc'] == 'yes':
        print('index found')
        return {'toc_content': toc_json['toc_content'], 'toc_page_list': toc_page_list, 'page_index_given_in_toc': 'yes'}

    current_start_index = toc_page_list[-1] + 1
    while (toc_json['page_index_given_in_toc'] == 'no' and
           current_start_index < len(page_list) and
           current_start_index < opt.toc_check_page_num):
        additional_toc_pages = find_toc_pages(start_page_index=current_start_index, page_list=page_list, opt=opt)
        if len(additional_toc_pages) == 0:
            break
        additional_toc_json = toc_extractor(page_list, additional_toc_pages, opt.model)
        if additional_toc_json['page_index_given_in_toc'] == 'yes':
            return {'toc_content': additional_toc_json['toc_content'], 'toc_page_list': additional_toc_pages, 'page_index_given_in_toc': 'yes'}
        current_start_index = additional_toc_pages[-1] + 1

    print('index not found')
    return {'toc_content': toc_json['toc_content'], 'toc_page_list': toc_page_list, 'page_index_given_in_toc': 'no'}


# ─── Fix & verify TOC ─────────────────────────────────────────────────────────

async def single_toc_item_index_fixer(section_title, content, model=None):
    toc_extractor_prompt = """
    You are given a section title and several pages of a document. Find the physical index of the start page.
    Tags <physical_index_X> indicate page X boundaries.
    Reply in JSON: {"thinking": <...>, "physical_index": "<physical_index_X>"}
    Directly return the final JSON structure. Do not output anything else."""

    prompt = toc_extractor_prompt + '\nSection Title:\n' + str(section_title) + '\nDocument pages:\n' + content
    response = await llm_acompletion(model=model, prompt=prompt)
    json_content = extract_json(response)
    return convert_physical_index_to_int(json_content['physical_index'])


async def fix_incorrect_toc(toc_with_page_number, page_list, incorrect_results, start_index=1, model=None, logger=None):
    print(f'start fix_incorrect_toc with {len(incorrect_results)} incorrect results')
    incorrect_indices = {result['list_index'] for result in incorrect_results}
    end_index = len(page_list) + start_index - 1
    incorrect_results_and_range_logs = []

    async def process_and_check_item(incorrect_item):
        list_index = incorrect_item['list_index']
        if list_index < 0 or list_index >= len(toc_with_page_number):
            return {'list_index': list_index, 'title': incorrect_item['title'],
                    'physical_index': incorrect_item.get('physical_index'), 'is_valid': False}

        prev_correct = start_index - 1
        for i in range(list_index - 1, -1, -1):
            if i not in incorrect_indices and 0 <= i < len(toc_with_page_number):
                pi = toc_with_page_number[i].get('physical_index')
                if pi is not None:
                    prev_correct = pi
                    break

        next_correct = end_index
        for i in range(list_index + 1, len(toc_with_page_number)):
            if i not in incorrect_indices and 0 <= i < len(toc_with_page_number):
                pi = toc_with_page_number[i].get('physical_index')
                if pi is not None:
                    next_correct = pi
                    break

        incorrect_results_and_range_logs.append({
            'list_index': list_index, 'title': incorrect_item['title'],
            'prev_correct': prev_correct, 'next_correct': next_correct,
        })

        page_contents = []
        for page_index in range(prev_correct, next_correct + 1):
            list_idx = page_index - start_index
            if 0 <= list_idx < len(page_list):
                page_text = f"<physical_index_{page_index}>\n{page_list[list_idx][0]}\n<physical_index_{page_index}>\n\n"
                page_contents.append(page_text)

        physical_index_int = await single_toc_item_index_fixer(incorrect_item['title'], ''.join(page_contents), model)
        check_item = incorrect_item.copy()
        check_item['physical_index'] = physical_index_int
        check_result = await check_title_appearance(check_item, page_list, start_index, model)
        return {'list_index': list_index, 'title': incorrect_item['title'],
                'physical_index': physical_index_int, 'is_valid': check_result['answer'] == 'yes'}

    tasks = [process_and_check_item(item) for item in incorrect_results]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    results = [r for r in results if not isinstance(r, Exception)]

    invalid_results = []
    for result in results:
        if result['is_valid']:
            li = result['list_index']
            if 0 <= li < len(toc_with_page_number):
                toc_with_page_number[li]['physical_index'] = result['physical_index']
            else:
                invalid_results.append(result)
        else:
            invalid_results.append(result)

    if logger:
        logger.info(f'incorrect_results_and_range_logs: {incorrect_results_and_range_logs}')
        logger.info(f'invalid_results: {invalid_results}')

    return toc_with_page_number, invalid_results


async def fix_incorrect_toc_with_retries(toc_with_page_number, page_list, incorrect_results,
                                          start_index=1, max_attempts=3, model=None, logger=None):
    print('start fix_incorrect_toc')
    fix_attempt = 0
    current_toc = toc_with_page_number
    current_incorrect = incorrect_results
    while current_incorrect:
        print(f"Fixing {len(current_incorrect)} incorrect results")
        current_toc, current_incorrect = await fix_incorrect_toc(
            current_toc, page_list, current_incorrect, start_index, model, logger)
        fix_attempt += 1
        if fix_attempt >= max_attempts:
            if logger:
                logger.info("Maximum fix attempts reached")
            break
    return current_toc, current_incorrect


async def verify_toc(page_list, list_result, start_index=1, N=None, model=None):
    print('start verify_toc')
    last_physical_index = None
    for item in reversed(list_result):
        if item.get('physical_index') is not None:
            last_physical_index = item['physical_index']
            break
    if last_physical_index is None or last_physical_index < len(page_list) / 2:
        return 0, []

    if N is None:
        sample_indices = range(0, len(list_result))
    else:
        N = min(N, len(list_result))
        sample_indices = random.sample(range(0, len(list_result)), N)

    indexed_sample_list = []
    for idx in sample_indices:
        item = list_result[idx]
        if item.get('physical_index') is not None:
            item_with_index = item.copy()
            item_with_index['list_index'] = idx
            indexed_sample_list.append(item_with_index)

    tasks = [check_title_appearance(item, page_list, start_index, model) for item in indexed_sample_list]
    results = await asyncio.gather(*tasks)

    correct_count = 0
    incorrect_results = []
    for result in results:
        if result['answer'] == 'yes':
            correct_count += 1
        else:
            incorrect_results.append(result)

    checked_count = len(results)
    accuracy = correct_count / checked_count if checked_count > 0 else 0
    print(f"accuracy: {accuracy * 100:.2f}%")
    return accuracy, incorrect_results


def validate_and_truncate_physical_indices(toc_with_page_number, page_list_length, start_index=1, logger=None):
    if not toc_with_page_number:
        return toc_with_page_number
    max_allowed_page = page_list_length + start_index - 1
    truncated_items = []
    for item in toc_with_page_number:
        if item.get('physical_index') is not None:
            if item['physical_index'] > max_allowed_page:
                truncated_items.append({'title': item.get('title', 'Unknown'), 'original_index': item['physical_index']})
                item['physical_index'] = None
                if logger:
                    logger.info(f"Removed physical_index for '{item.get('title', 'Unknown')}'")
    if truncated_items and logger:
        logger.info(f"Total removed items: {len(truncated_items)}")
    print(f"Document validation: {page_list_length} pages, max allowed index: {max_allowed_page}")
    return toc_with_page_number


# ─── Main pipeline ────────────────────────────────────────────────────────────

async def meta_processor(page_list, mode=None, toc_content=None, toc_page_list=None,
                          start_index=1, opt=None, logger=None):
    print(mode)
    print(f'start_index: {start_index}')

    if mode == 'process_toc_with_page_numbers':
        toc_with_page_number = process_toc_with_page_numbers(
            toc_content, toc_page_list, page_list, toc_check_page_num=opt.toc_check_page_num, model=opt.model, logger=logger)
    elif mode == 'process_toc_no_page_numbers':
        toc_with_page_number = process_toc_no_page_numbers(
            toc_content, toc_page_list, page_list, model=opt.model, logger=logger)
    else:
        toc_with_page_number = process_no_toc(page_list, start_index=start_index, model=opt.model, logger=logger)

    toc_with_page_number = [item for item in toc_with_page_number if item.get('physical_index') is not None]
    toc_with_page_number = validate_and_truncate_physical_indices(
        toc_with_page_number, len(page_list), start_index=start_index, logger=logger)

    accuracy, incorrect_results = await verify_toc(page_list, toc_with_page_number, start_index=start_index, model=opt.model)
    if logger:
        logger.info({'mode': mode, 'accuracy': accuracy, 'incorrect_results': incorrect_results})

    if accuracy == 1.0 and len(incorrect_results) == 0:
        return toc_with_page_number
    if accuracy > 0.6:
        toc_with_page_number, _ = await fix_incorrect_toc_with_retries(
            toc_with_page_number, page_list, incorrect_results, start_index=start_index,
            max_attempts=3, model=opt.model, logger=logger)
        return toc_with_page_number
    else:
        if mode == 'process_toc_with_page_numbers':
            return await meta_processor(page_list, mode='process_toc_no_page_numbers',
                                        toc_content=toc_content, toc_page_list=toc_page_list,
                                        start_index=start_index, opt=opt, logger=logger)
        elif mode == 'process_toc_no_page_numbers':
            return await meta_processor(page_list, mode='process_no_toc', start_index=start_index, opt=opt, logger=logger)
        else:
            raise Exception('Processing failed')


async def process_large_node_recursively(node, page_list, opt=None, logger=None):
    node_page_list = page_list[node['start_index'] - 1:node['end_index']]
    token_num = sum([page[1] for page in node_page_list])

    if node['end_index'] - node['start_index'] > opt.max_page_num_each_node and token_num >= opt.max_token_num_each_node:
        print('large node:', node['title'], 'start_index:', node['start_index'], 'end_index:', node['end_index'])
        node_toc_tree = await meta_processor(node_page_list, mode='process_no_toc',
                                              start_index=node['start_index'], opt=opt, logger=logger)
        node_toc_tree = await check_title_appearance_in_start_concurrent(node_toc_tree, page_list, model=opt.model, logger=logger)
        valid_node_toc_items = [item for item in node_toc_tree if item.get('physical_index') is not None]

        if valid_node_toc_items and node['title'].strip() == valid_node_toc_items[0]['title'].strip():
            node['nodes'] = post_processing(valid_node_toc_items[1:], node['end_index'])
            node['end_index'] = valid_node_toc_items[1]['start_index'] if len(valid_node_toc_items) > 1 else node['end_index']
        else:
            node['nodes'] = post_processing(valid_node_toc_items, node['end_index'])
            node['end_index'] = valid_node_toc_items[0]['start_index'] if valid_node_toc_items else node['end_index']

    if 'nodes' in node and node['nodes']:
        tasks = [process_large_node_recursively(child, page_list, opt, logger=logger) for child in node['nodes']]
        await asyncio.gather(*tasks)

    return node


async def tree_parser(page_list, opt, doc=None, logger=None):
    check_toc_result = check_toc(page_list, opt)
    if logger:
        logger.info(check_toc_result)

    if (check_toc_result.get("toc_content") and
            check_toc_result["toc_content"].strip() and
            check_toc_result["page_index_given_in_toc"] == "yes"):
        toc_with_page_number = await meta_processor(
            page_list, mode='process_toc_with_page_numbers', start_index=1,
            toc_content=check_toc_result['toc_content'],
            toc_page_list=check_toc_result['toc_page_list'], opt=opt, logger=logger)
    else:
        toc_with_page_number = await meta_processor(
            page_list, mode='process_no_toc', start_index=1, opt=opt, logger=logger)

    toc_with_page_number = add_preface_if_needed(toc_with_page_number)
    toc_with_page_number = await check_title_appearance_in_start_concurrent(
        toc_with_page_number, page_list, model=opt.model, logger=logger)
    valid_toc_items = [item for item in toc_with_page_number if item.get('physical_index') is not None]

    toc_tree = post_processing(valid_toc_items, len(page_list))
    tasks = [process_large_node_recursively(node, page_list, opt, logger=logger) for node in toc_tree]
    await asyncio.gather(*tasks)
    return toc_tree


def page_index_main(doc, opt=None):
    logger = JsonLogger(doc)
    is_valid_pdf = (
        (isinstance(doc, str) and os.path.isfile(doc) and doc.lower().endswith(".pdf")) or
        isinstance(doc, BytesIO)
    )
    if not is_valid_pdf:
        raise ValueError("Unsupported input type. Expected a PDF file path or BytesIO object.")

    print('Parsing PDF...')
    page_list = get_page_tokens(doc, model=opt.model)
    if logger:
        logger.info({'total_page_number': len(page_list)})
        logger.info({'total_token': sum([page[1] for page in page_list])})

    async def page_index_builder():
        structure = await tree_parser(page_list, opt, doc=doc, logger=logger)
        if opt.if_add_node_id == 'yes':
            write_node_id(structure)
        if opt.if_add_node_text == 'yes':
            add_node_text(structure, page_list)
        if opt.if_add_node_summary == 'yes':
            if opt.if_add_node_text == 'no':
                add_node_text(structure, page_list)
            await generate_summaries_for_structure(structure, model=opt.model)
            if opt.if_add_node_text == 'no':
                remove_structure_text(structure)
            if opt.if_add_doc_description == 'yes':
                clean_structure = create_clean_structure_for_description(structure)
                doc_description = generate_doc_description(clean_structure, model=opt.model)
                return {
                    'doc_name': get_pdf_name(doc),
                    'doc_description': doc_description,
                    'structure': structure,
                }
        return {
            'doc_name': get_pdf_name(doc),
            'structure': structure,
        }

    return asyncio.run(page_index_builder())


def page_index(doc, model=None, toc_check_page_num=None, max_page_num_each_node=None,
               max_token_num_each_node=None, if_add_node_id=None, if_add_node_summary=None,
               if_add_doc_description=None, if_add_node_text=None):
    user_opt = {
        arg: value for arg, value in locals().items()
        if arg != "doc" and value is not None
    }
    opt = ConfigLoader().load(user_opt)
    return page_index_main(doc, opt)
