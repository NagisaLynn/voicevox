<template>
  <QDialog
    v-model="hotkeySettingDialogOpenComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="hotkey-setting-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr lff" class="bg-background">
      <QHeader class="q-py-sm">
        <QToolbar>
          <QToolbarTitle class="text-display"
            >設定 / キー割り当て</QToolbarTitle
          >
          <QInput
            v-model="hotkeyFilter"
            hideBottomSpace
            dense
            placeholder="検索"
            color="display"
            class="q-mr-sm search-box"
          >
            <template #prepend>
              <QIcon name="search" />
            </template>
            <template #append>
              <QIcon
                v-if="hotkeyFilter !== ''"
                name="close"
                class="cursor-pointer"
                @click="hotkeyFilter = ''"
              />
              <QIcon v-else />
            </template>
          </QInput>
          <QBtn
            round
            flat
            icon="close"
            color="display"
            @click="hotkeySettingDialogOpenComputed = false"
          />
        </QToolbar>
      </QHeader>

      <QPageContainer>
        <QPage>
          <QTable
            v-model:pagination="hotkeyPagination"
            flat
            dense
            hideBottom
            cardClass="bg-background text-display"
            tableClass="text-display"
            rowKey="hotkeyIndexes"
            :filter="hotkeyFilter"
            :rows="hotkeySettings"
            :columns="hotkeyColumns"
            class="hotkey-table"
          >
            <template #header="tableProps">
              <QTr :props="tableProps">
                <QTh
                  v-for="col of tableProps.cols"
                  :key="col.name"
                  :props="tableProps"
                >
                  {{ col.label }}
                </QTh>
              </QTr>
            </template>

            <template #body="tableProps">
              <QTr :props="tableProps">
                <QTd :key="tableProps.cols[0].name" noHover :props="tableProps">
                  {{ tableProps.row.action }}
                </QTd>
                <QTd :key="tableProps.cols[1].name" noHover :props="tableProps">
                  <QBtn
                    dense
                    textColor="display"
                    padding="none sm"
                    flat
                    :disable="checkHotkeyReadonly(tableProps.row.action)"
                    noCaps
                    :label="
                      getHotkeyText(
                        tableProps.row.action,
                        tableProps.row.combination,
                      )
                        .split(' ')
                        .map((hotkeyText) => {
                          // Mac の Meta キーは Cmd キーであるため、Meta の表示名を Cmd に置換する
                          // Windows PC では Meta キーは Windows キーだが、使用頻度低と考えられるため暫定的に Mac 対応のみを考慮している
                          return hotkeyText === 'Meta' ? 'Cmd' : hotkeyText;
                        })
                        .join(' + ')
                    "
                    @click="openHotkeyDialog(tableProps.row.action)"
                  />
                  <QBtn
                    rounded
                    flat
                    icon="settings_backup_restore"
                    padding="none sm"
                    size="1em"
                    :disable="checkHotkeyReadonly(tableProps.row.action)"
                    @click="resetHotkey(tableProps.row.action)"
                  >
                    <QTooltip :delay="500">デフォルトに戻す</QTooltip>
                  </QBtn>
                </QTd>
              </QTr>
            </template>
          </QTable>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>

  <HotkeyRecordingDialog
    :isHotkeyDialogOpened
    :lastAction
    :lastRecord
    :duplicatedHotkey
    @update:modelValue="setHotkeyDialogOpened"
    @deleteHotkey="deleteHotkey"
    @changeHotkeySettings="changeHotkeySettings"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import HotkeyRecordingDialog from "./HotkeyRecordingDialog.vue";
import { useStore } from "@/store";
import {
  HotkeyActionNameType,
  HotkeyCombination,
  HotkeySettingType,
} from "@/type/preload";
import { useHotkeyManager, eventToCombination } from "@/plugins/hotkeyPlugin";

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
}>();

const store = useStore();

const hotkeySettingDialogOpenComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const isHotkeyDialogOpened = ref(false);

const hotkeyPagination = ref({ rowsPerPage: 0 });
const hotkeyFilter = ref("");

const hotkeySettings = computed(() => store.state.hotkeySettings);

// FIXME: satisfiesを使うなどで型を表現したい
const hotkeyColumns = ref<
  {
    name: string;
    align: "left" | "right" | "center" | undefined;
    label: string;
    field: string;
  }[]
>([
  {
    name: "action",
    align: "left",
    label: "操作",
    field: "action",
  },
  {
    name: "combination",
    align: "left",
    label: "ショートカットキー",
    field: "combination",
  },
]);

const lastAction = ref("");
const lastRecord = ref(HotkeyCombination(""));

// FIXME: HotkeyRecordingDialog内に移動する
const recordCombination = (event: KeyboardEvent) => {
  if (!isHotkeyDialogOpened.value) {
    return;
  } else {
    const recordedCombo = eventToCombination(event);
    lastRecord.value = recordedCombo;
    event.preventDefault();
  }
};

// FIXME: HotkeyRecordingDialog内に移動する
const { hotkeyManager } = useHotkeyManager();
const changeHotkeySettings = (
  action: string,
  combination: HotkeyCombination,
) => {
  hotkeyManager.replace({
    action: action as HotkeyActionNameType,
    combination,
  });
  return store.dispatch("SET_HOTKEY_SETTINGS", {
    data: {
      action: action as HotkeyActionNameType,
      combination,
    },
  });
};

const duplicatedHotkey = computed(() => {
  if (lastRecord.value == "") return undefined;
  return hotkeySettings.value.find(
    (item) =>
      item.combination == lastRecord.value && item.action != lastAction.value,
  );
});

// FIXME: actionはHotkeyAction型にすべき
const deleteHotkey = (action: string) => {
  void changeHotkeySettings(action, HotkeyCombination(""));
};

const getHotkeyText = (action: string, combo: string) => {
  if (checkHotkeyReadonly(action)) combo = "（読み取り専用）" + combo;
  if (combo == "") return "未設定";
  else return combo;
};

// for later developers, in case anyone wants to add a readonly hotkey
const readonlyHotkeyKeys: string[] = [];

const checkHotkeyReadonly = (action: string) => {
  let flag = false;
  readonlyHotkeyKeys.forEach((key) => {
    if (key == action) {
      flag = true;
    }
  });
  return flag;
};

const openHotkeyDialog = (action: string) => {
  lastAction.value = action;
  lastRecord.value = HotkeyCombination("");
  isHotkeyDialogOpened.value = true;
  document.addEventListener("keydown", recordCombination);
};

const setHotkeyDialogOpened = () => {
  lastAction.value = "";
  lastRecord.value = HotkeyCombination("");
  isHotkeyDialogOpened.value = false;
  document.removeEventListener("keydown", recordCombination);
};

const resetHotkey = async (action: string) => {
  const result = await store.dispatch("SHOW_CONFIRM_DIALOG", {
    title: "ショートカットキーを初期値に戻します",
    message: `${action}のショートカットキーを初期値に戻します。\n本当に戻しますか？`,
    actionName: "初期値に戻す",
    cancel: "初期値に戻さない",
  });
  if (result === "OK") {
    void window.backend
      .getDefaultHotkeySettings()
      .then((defaultSettings: HotkeySettingType[]) => {
        const setting = defaultSettings.find((value) => value.action == action);
        if (setting == undefined) {
          return;
        }
        // デフォルトが未設定でない場合は、衝突チェックを行う
        if (setting.combination) {
          const duplicated = hotkeySettings.value.find(
            (item) =>
              item.combination == setting.combination && item.action != action,
          );
          if (duplicated != undefined) {
            openHotkeyDialog(action);
            lastRecord.value = duplicated.combination;
            return;
          }
        }
        void changeHotkeySettings(action, setting.combination);
      });
  }
};
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.search-box {
  width: 200px;
}

.hotkey-table {
  width: calc(100vw - #{vars.$window-border-width * 2});
  height: calc(
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
      vars.$window-border-width}
  );

  > :deep(.scroll) {
    overflow-y: scroll;
    overflow-x: hidden;
  }

  tbody tr {
    td button:last-child {
      float: right;
      display: none;
    }
    &:hover td button:last-child {
      display: inline-flex;
      color: colors.$display;
      opacity: 0.5;
      &:hover {
        opacity: 1;
      }
    }
  }

  thead tr th {
    position: sticky;
    top: 0;
    font-weight: bold;
    background-color: colors.$surface;
    z-index: 1;
  }

  thead tr th:first-child,
  tbody tr td:first-child {
    width: 70%;
    max-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  thead tr th:last-child,
  tbody tr td:last-child {
    max-width: 0;
    min-width: 180px;
  }
}

.q-layout-container > :deep(.absolute-full) {
  right: 0 !important;
  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}
</style>
