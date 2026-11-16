/** Official NCDD Phnom Penh district/sangkat names and codes.
 * Source: https://db.ncdd.gov.kh/gazetteer/view/province.castle?pv=12
 * Each district: https://db.ncdd.gov.kh/gazetteer/view/district.castle?ds={code}
 * Checked: 2026-11-16. Refresh with node scripts/update-phnom-penh.mjs.
 */
export interface Sangkat { code: string; name: string; km: string }
export interface PhnomPenhDistrict { code: string; name: string; km: string; sangkats: Sangkat[] }
export const PHNOM_PENH_DISTRICTS: PhnomPenhDistrict[] = [
  {
    "code": "1201",
    "name": "Chamkar Mon",
    "km": "ចំការមន",
    "sangkats": [
      {
        "code": "120101",
        "name": "Tonle Basak",
        "km": "ទន្លេបាសាក់"
      },
      {
        "code": "120109",
        "name": "Tuol Tumpung Ti Pir",
        "km": "ទួលទំពូងទី ២"
      },
      {
        "code": "120110",
        "name": "Tuol Tumpung Ti Muoy",
        "km": "ទួលទំពូងទី ១"
      },
      {
        "code": "120111",
        "name": "Boeng Trabaek",
        "km": "បឹងត្របែក"
      },
      {
        "code": "120112",
        "name": "Phsar Daeum Thkov",
        "km": "ផ្សារដើមថ្កូវ"
      }
    ]
  },
  {
    "code": "1202",
    "name": "Doun Penh",
    "km": "ដូនពេញ",
    "sangkats": [
      {
        "code": "120201",
        "name": "Phsar Thmei Ti Muoy",
        "km": "ផ្សារថ្មីទី ១"
      },
      {
        "code": "120202",
        "name": "Phsar Thmei Ti Pir",
        "km": "ផ្សារថ្មីទី ២"
      },
      {
        "code": "120203",
        "name": "Phsar Thmei Ti Bei",
        "km": "ផ្សារថ្មីទី ៣"
      },
      {
        "code": "120204",
        "name": "Boeng Reang",
        "km": "បឹងរាំង"
      },
      {
        "code": "120205",
        "name": "Phsar Kandal Ti Muoy",
        "km": "ផ្សារកណ្ដាលទី១"
      },
      {
        "code": "120206",
        "name": "Phsar Kandal Ti Pir",
        "km": "ផ្សារកណ្ដាលទី២"
      },
      {
        "code": "120207",
        "name": "Chakto Mukh",
        "km": "ចតុមុខ"
      },
      {
        "code": "120208",
        "name": "Chey Chummeah",
        "km": "ជ័យជំនះ"
      },
      {
        "code": "120209",
        "name": "Phsar Chas",
        "km": "ផ្សារចាស់"
      },
      {
        "code": "120210",
        "name": "Srah Chak",
        "km": "ស្រះចក"
      },
      {
        "code": "120211",
        "name": "Voat Phnum",
        "km": "វត្ដភ្នំ"
      }
    ]
  },
  {
    "code": "1203",
    "name": "Prampir Meakkakra",
    "km": "៧មករា",
    "sangkats": [
      {
        "code": "120301",
        "name": "Ou Ruessei Ti Muoy",
        "km": "អូរឫស្សីទី ១"
      },
      {
        "code": "120302",
        "name": "Ou Ruessei Ti Pir",
        "km": "អូរឫស្សីទី ២"
      },
      {
        "code": "120303",
        "name": "Ou Ruessei Ti Bei",
        "km": "អូរឫស្សីទី ៣"
      },
      {
        "code": "120304",
        "name": "Ou Ruessei Ti Buon",
        "km": "អូរឫស្សីទី ៤"
      },
      {
        "code": "120305",
        "name": "Monourom",
        "km": "មនោរម្យ"
      },
      {
        "code": "120306",
        "name": "Mittapheap",
        "km": "មិត្ដភាព"
      },
      {
        "code": "120307",
        "name": "Veal Vong",
        "km": "វាលវង់"
      },
      {
        "code": "120308",
        "name": "Boeng Proluet",
        "km": "បឹងព្រលឹត"
      }
    ]
  },
  {
    "code": "1204",
    "name": "Tuol Kouk",
    "km": "ទួលគោក",
    "sangkats": [
      {
        "code": "120401",
        "name": "Phsar Depou Ti Muoy",
        "km": "ផ្សារដេប៉ូទី ១"
      },
      {
        "code": "120402",
        "name": "Phsar Depou Ti Pir",
        "km": "ផ្សារដេប៉ូទី ២"
      },
      {
        "code": "120403",
        "name": "Phsar Depou Ti Bei",
        "km": "ផ្សារដេប៉ូទី ៣"
      },
      {
        "code": "120404",
        "name": "Tuek L'ak Ti Muoy",
        "km": "ទឹកល្អក់ទី ១"
      },
      {
        "code": "120405",
        "name": "Tuek L'ak Ti Pir",
        "km": "ទឹកល្អក់ទី ២"
      },
      {
        "code": "120406",
        "name": "Tuek L'ak Ti Bei",
        "km": "ទឹកល្អក់ទី ៣"
      },
      {
        "code": "120407",
        "name": "Boeng Kak Ti Muoy",
        "km": "បឹងកក់ទី ១"
      },
      {
        "code": "120408",
        "name": "Boeng Kak Ti Pir",
        "km": "បឹងកក់ទី ២"
      },
      {
        "code": "120409",
        "name": "Phsar Daeum Kor",
        "km": "ផ្សារដើមគរ"
      },
      {
        "code": "120410",
        "name": "Boeng Salang",
        "km": "បឹងសាឡាង"
      }
    ]
  },
  {
    "code": "1205",
    "name": "Dangkao",
    "km": "ដង្កោ",
    "sangkats": [
      {
        "code": "120501",
        "name": "Dangkao",
        "km": "ដង្កោ"
      },
      {
        "code": "120507",
        "name": "Pong Tuek",
        "km": "ពងទឹក"
      },
      {
        "code": "120508",
        "name": "Prey Veaeng",
        "km": "ព្រៃវែង"
      },
      {
        "code": "120510",
        "name": "Prey Sa",
        "km": "ព្រៃស"
      },
      {
        "code": "120512",
        "name": "Krang Pongro",
        "km": "ក្រាំងពង្រ"
      },
      {
        "code": "120514",
        "name": "Sak Sampov",
        "km": "សាក់សំពៅ"
      },
      {
        "code": "120515",
        "name": "Cheung Aek",
        "km": "ជើងឯក"
      },
      {
        "code": "120516",
        "name": "Kong Noy",
        "km": "គងនយ"
      },
      {
        "code": "120517",
        "name": "Preaek Kampues",
        "km": "ព្រែកកំពឹស"
      },
      {
        "code": "120518",
        "name": "Roluos",
        "km": "រលួស"
      },
      {
        "code": "120519",
        "name": "Spean Thma",
        "km": "ស្ពានថ្ម"
      },
      {
        "code": "120520",
        "name": "Tien",
        "km": "ទៀន"
      }
    ]
  },
  {
    "code": "1206",
    "name": "Mean Chey",
    "km": "មានជ័យ",
    "sangkats": [
      {
        "code": "120606",
        "name": "Chak Angrae Leu",
        "km": "ចាក់អង្រែលើ"
      },
      {
        "code": "120607",
        "name": "Chak Angrae Kraom",
        "km": "ចាក់អង្រែក្រោម"
      },
      {
        "code": "120608",
        "name": "Stueng Mean chey 1",
        "km": "ស្ទឹងមានជ័យទី១"
      },
      {
        "code": "120609",
        "name": "Stueng Mean chey 2",
        "km": "ស្ទឹងមានជ័យទី២"
      },
      {
        "code": "120610",
        "name": "Stueng Mean chey 3",
        "km": "ស្ទឹងមានជ័យទី៣"
      },
      {
        "code": "120611",
        "name": "Boeng Tumpun 1",
        "km": "បឹងទំពុនទី១"
      },
      {
        "code": "120612",
        "name": "Boeng Tumpun 2",
        "km": "បឹងទំពុនទី២"
      }
    ]
  },
  {
    "code": "1207",
    "name": "Russey Keo",
    "km": "ឫស្សីកែវ",
    "sangkats": [
      {
        "code": "120703",
        "name": "Svay Pak",
        "km": "ស្វាយប៉ាក"
      },
      {
        "code": "120704",
        "name": "Kilomaetr Lekh Prammuoy",
        "km": "គីឡូម៉ែត្រលេខ៦"
      },
      {
        "code": "120706",
        "name": "Ruessei Kaev",
        "km": "ឫស្សីកែវ"
      },
      {
        "code": "120711",
        "name": "Chrang Chamreh Ti Muoy",
        "km": "ច្រាំងចំរេះទី ១"
      },
      {
        "code": "120712",
        "name": "Chrang Chamreh Ti Pir",
        "km": "ច្រាំងចំរេះទី ២"
      },
      {
        "code": "120713",
        "name": "Tuol Sangkae 1",
        "km": "ទួលសង្កែទី១"
      },
      {
        "code": "120714",
        "name": "Tuol Sangkae 2",
        "km": "ទួលសង្កែទី២"
      }
    ]
  },
  {
    "code": "1208",
    "name": "Saensokh",
    "km": "សែនសុខ",
    "sangkats": [
      {
        "code": "120801",
        "name": "Phnom Penh Thmei",
        "km": "ភ្នំពេញថ្មី"
      },
      {
        "code": "120802",
        "name": "Tuek Thla",
        "km": "ទឹកថ្លា"
      },
      {
        "code": "120803",
        "name": "Khmuonh",
        "km": "ឃ្មួញ"
      },
      {
        "code": "120807",
        "name": "Krang Thnong",
        "km": "ក្រាំងធ្នង់"
      },
      {
        "code": "120808",
        "name": "Ou Baek K'am",
        "km": "អូរបែកក្អម"
      },
      {
        "code": "120809",
        "name": "Kouk Khleang",
        "km": "គោកឃ្លាង"
      }
    ]
  },
  {
    "code": "1209",
    "name": "Pur SenChey",
    "km": "ពោធិ៍សែនជ័យ",
    "sangkats": [
      {
        "code": "120901",
        "name": "Trapeang Krasang",
        "km": "ត្រពាំងក្រសាំង"
      },
      {
        "code": "120906",
        "name": "Samraong Kraom",
        "km": "សំរោងក្រោម"
      },
      {
        "code": "120914",
        "name": "Chaom Chau 1",
        "km": "ចោមចៅទី១"
      },
      {
        "code": "120915",
        "name": "Chaom Chau 2",
        "km": "ចោមចៅទី២"
      },
      {
        "code": "120916",
        "name": "Chaom Chau 3",
        "km": "ចោមចៅទី៣"
      },
      {
        "code": "120917",
        "name": "Kakab 1",
        "km": "កាកាបទី១"
      },
      {
        "code": "120918",
        "name": "Kakab 2",
        "km": "កាកាបទី២"
      }
    ]
  },
  {
    "code": "1210",
    "name": "Chrouy Changvar",
    "km": "ជ្រោយចង្វារ",
    "sangkats": [
      {
        "code": "121001",
        "name": "Chrouy Changvar",
        "km": "ជ្រោយចង្វារ"
      },
      {
        "code": "121002",
        "name": "Preaek Lieb",
        "km": "ព្រែកលៀប"
      },
      {
        "code": "121003",
        "name": "Preaek Ta Sek",
        "km": "ព្រែកតាសេក"
      },
      {
        "code": "121004",
        "name": "Kaoh Dach",
        "km": "កោះដាច់"
      },
      {
        "code": "121005",
        "name": "Bak Kaeng",
        "km": "បាក់ខែង"
      }
    ]
  },
  {
    "code": "1211",
    "name": "Praek Pnov",
    "km": "ព្រែកព្នៅ",
    "sangkats": [
      {
        "code": "121101",
        "name": "Preaek Phnov",
        "km": "ព្រែកព្នៅ"
      },
      {
        "code": "121102",
        "name": "Ponhea Pon",
        "km": "ពញាពន់"
      },
      {
        "code": "121103",
        "name": "Samraong",
        "km": "សំរោង"
      },
      {
        "code": "121104",
        "name": "Kouk Roka",
        "km": "គោករកា"
      },
      {
        "code": "121105",
        "name": "Ponsang",
        "km": "ពន្សាំង"
      }
    ]
  },
  {
    "code": "1212",
    "name": "Chbar Ampov",
    "km": "ច្បារអំពៅ",
    "sangkats": [
      {
        "code": "121201",
        "name": "Chhbar Ampov Ti Muoy",
        "km": "ច្បារអំពៅទី ១"
      },
      {
        "code": "121202",
        "name": "Chbar Ampov Ti Pir",
        "km": "ច្បារអំពៅទី ២"
      },
      {
        "code": "121203",
        "name": "Nirouth",
        "km": "និរោធ"
      },
      {
        "code": "121204",
        "name": "Preaek Pra",
        "km": "ព្រែកប្រា"
      },
      {
        "code": "121205",
        "name": "Veal Sbov",
        "km": "វាលស្បូវ"
      },
      {
        "code": "121206",
        "name": "Preaek Aeng",
        "km": "ព្រែកឯង"
      },
      {
        "code": "121207",
        "name": "Kbal Kaoh",
        "km": "ក្បាលកោះ"
      },
      {
        "code": "121208",
        "name": "Preaek Thmei",
        "km": "ព្រែកថ្មី"
      }
    ]
  },
  {
    "code": "1213",
    "name": "Boeng Keng Kang",
    "km": "បឹងកេងកង",
    "sangkats": [
      {
        "code": "121301",
        "name": "Boeng Keng Kang Ti Muoy",
        "km": "បឹងកេងកងទី ១"
      },
      {
        "code": "121302",
        "name": "Boeng Keng Kang Ti Pir",
        "km": "បឹងកេងកងទី ២"
      },
      {
        "code": "121303",
        "name": "Boeng Keng Kang Ti Bei",
        "km": "បឹងកេងកងទី ៣"
      },
      {
        "code": "121304",
        "name": "Olympic",
        "km": "អូឡាំពិក"
      },
      {
        "code": "121305",
        "name": "Tumnob Tuek",
        "km": "ទំនប់ទឹក"
      },
      {
        "code": "121306",
        "name": "Tuol Svay Prey Ti Muoy",
        "km": "ទួលស្វាយព្រៃទី ១"
      },
      {
        "code": "121307",
        "name": "Tuol Svay Prey Ti Pir",
        "km": "ទួលស្វាយព្រៃទី ២"
      }
    ]
  },
  {
    "code": "1214",
    "name": "Kamboul",
    "km": "កំបូល",
    "sangkats": [
      {
        "code": "121401",
        "name": "Kamboul",
        "km": "កំបូល"
      },
      {
        "code": "121402",
        "name": "Kantaok",
        "km": "កន្ទោក"
      },
      {
        "code": "121403",
        "name": "Ovlaok",
        "km": "ឪឡោក"
      },
      {
        "code": "121404",
        "name": "Snaor",
        "km": "ស្នោរ"
      },
      {
        "code": "121405",
        "name": "Phleung Chheh Roteh",
        "km": "ភ្លើងឆេះរទេះ"
      },
      {
        "code": "121406",
        "name": "Boeng Thum",
        "km": "បឹងធំ"
      },
      {
        "code": "121407",
        "name": "Prateah Lang",
        "km": "ប្រទះឡាង"
      }
    ]
  }
];
